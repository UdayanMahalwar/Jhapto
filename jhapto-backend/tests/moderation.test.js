const { api, db, sql, resetDb, login, bearer } = require('./helpers/testkit');
const moderation = require('../utils/moderation');

beforeAll(resetDb);
afterAll(() => db.end());
afterEach(() => moderation._setClientForTests(undefined));

// A stand-in for the Anthropic client that records requests and returns a fixed verdict
const fakeClaude = (verdict) => {
  const calls = [];
  const client = {
    calls,
    beta: { messages: { create: async (req) => {
      calls.push(req);
      if (verdict instanceof Error) throw verdict;
      return { stop_reason: verdict.stop_reason || 'end_turn', content: [{ type: 'text', text: JSON.stringify(verdict) }] };
    } } },
  };
  return client;
};

describe('keyword rules', () => {
  test.each([
    'Selling weed, DM',
    'also have w33d',
    'cheap c i g a r e t t e s in K-204',
    'v.o.d.k.a available',
    'Daaru party pack',
    'Leaked paper for DBMS mid-sem',
  ])('blocks %p', (text) => {
    expect(moderation.checkRules(text).allowed).toBe(false);
  });

  test.each([
    'Chilled Coke, 2 left',
    'Ginger flavour, sealed pack',
    'Gingerbread cookies',
    'Brown sugar for baking',
    'Classes have begun, grab notebooks',
    'Buy 1 get 1 free',
    '',
    null,
  ])('allows %p', (text) => {
    expect(moderation.checkRules(text).allowed).toBe(true);
  });
});

describe('listing routes', () => {
  const base = { item_id: 6, mrp: '60', selling_price: '55', quantity_available: '3', room_number: 'K-101' };

  test('a banned word in the description is refused (no AI needed)', async () => {
    const res = await api().post('/api/listings').set(bearer(await login('karan')))
      .send({ ...base, description: 'Also selling vapes, ask' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/tobacco or vapes/);
  });

  test('the AI review can block what keywords miss', async () => {
    const claude = fakeClaude({ allowed: false, category: 'drugs', reason: 'The description advertises drugs in code.' });
    moderation._setClientForTests(claude);
    const res = await api().post('/api/listings').set(bearer(await login('karan')))
      .send({ ...base, description: 'got the green stuff too, DM' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/advertises drugs/);

    const req = claude.calls[0];
    expect(req.output_config.format.type).toBe('json_schema');
    const text = req.messages[0].content.find((b) => b.type === 'text').text;
    expect(text).toMatch(/Catalogue item: .+\nCategory: .+/);
    expect(text).toMatch(/green stuff/);
    expect((await sql('SELECT COUNT(*) AS n FROM Listing WHERE description = ?', ['got the green stuff too, DM']))[0].n).toBe(0);
  });

  test('a refusal from the model is treated as blocked', async () => {
    moderation._setClientForTests(fakeClaude({ stop_reason: 'refusal' }));
    const res = await api().post('/api/listings').set(bearer(await login('karan'))).send({ ...base, description: 'x' });
    expect(res.status).toBe(422);
  });

  test('an AI outage does not block selling (keyword rules still apply)', async () => {
    moderation._setClientForTests(fakeClaude(new Error('overloaded')));
    const res = await api().post('/api/listings').set(bearer(await login('karan'))).send({ ...base, description: 'Unused, sealed' });
    expect(res.status).toBe(201);
  });

  test('the uploaded photo is sent to the AI review', async () => {
    const token = await login('karan');
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
      '1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex');
    const up = await api().post('/api/uploads').set(bearer(token)).attach('image', png, 'p.png').expect(201);

    const claude = fakeClaude({ allowed: false, category: 'tobacco or vapes', reason: 'The photo shows a vape.' });
    moderation._setClientForTests(claude);
    const res = await api().post('/api/listings').set(bearer(token)).send({ ...base, item_id: 7, photo_url: up.body.url });
    expect(res.status).toBe(422);
    const image = claude.calls[0].messages[0].content[0];
    expect(image).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } });
  });

  test('edits to the description are checked too', async () => {
    const res = await api().patch('/api/listings/4').set(bearer(await login('sneha')))
      .send({ description: 'beer also available' });
    expect(res.status).toBe(422);
    // a price-only edit is not re-checked and still works
    const claude = fakeClaude({ allowed: true, category: 'none', reason: '' });
    moderation._setClientForTests(claude);
    await api().patch('/api/listings/4').set(bearer(await login('sneha'))).send({ selling_price: '29' }).expect(200);
    expect(claude.calls).toHaveLength(0);
  });
});
