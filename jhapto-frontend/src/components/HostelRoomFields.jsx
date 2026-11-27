import React from 'react';
import { hostelLabel, ROOM_PATTERN } from '../utils/hostel';

// Hostel picker + room number, used at sign-up and on the profile page.
// Buyers collect items from this room, so sellers never type it per listing.
const HostelRoomFields = ({ hostels, hostelId, room, onChange, labelled = false }) => {
  const select = (
    <select className={labelled ? 'input' : undefined} aria-label="Hostel" required value={hostelId || ''}
      onChange={(e) => onChange({ hostel_id: Number(e.target.value) })}>
      <option value="" disabled>Your hostel</option>
      {hostels.map((h) => <option key={h.hostel_id} value={h.hostel_id}>{hostelLabel(h)}</option>)}
    </select>
  );
  const input = (
    <input className={labelled ? 'input' : undefined} type="text" name="room_number" aria-label="Room number" required
      maxLength={20} pattern={ROOM_PATTERN} title="Room number, e.g. A-204" placeholder="Room no. (e.g. A-204)"
      autoComplete="off" value={room || ''} onChange={(e) => onChange({ room_number: e.target.value })} />
  );
  if (!labelled) return <div className="form-row">{select}{input}</div>;
  return (
    <>
      <label className="field"><span>Hostel</span>{select}</label>
      <label className="field"><span>Room number</span>{input}
        <span className="field-hint">Buyers collect your items from this room.</span>
      </label>
    </>
  );
};

export default HostelRoomFields;
