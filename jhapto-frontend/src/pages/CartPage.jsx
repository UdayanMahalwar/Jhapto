import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import { AuthContext } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';

const qtyBtn = { width: 32, height: 32, borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

const CartPage = () => {
  const { user, logout } = useContext(AuthContext);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const handleCheckout = async () => {
    try {
      const result = await cart.checkout();
      if (!result) return;
      toast(result.message || 'Order placed!');
      navigate('/orders');
    } catch (err) {
      toast(err.response?.data?.message || 'Error placing order', 'error');
    }
  };

  const increase = (item) => {
    const error = cart.add(item);
    if (error) toast(error, 'error');
  };

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <div style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
        <h2 className="text-gradient" style={{ marginBottom: '1.5rem' }}>Your Cart</h2>

        {cart.items.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Your cart is empty.</p>
            <button className="auth-btn" style={{ marginTop: 0, padding: '0.6rem 1.5rem' }} onClick={() => navigate('/')}>Browse listings</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cart.items.map(item => (
                <div key={item.listing_id} className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Sold by {item.seller_name} · ₹{item.selling_price.toFixed(2)} each
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button style={qtyBtn} aria-label={`One less ${item.item_name}`} onClick={() => cart.remove(item.listing_id)}><Minus size={16} /></button>
                    <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                    <button style={qtyBtn} aria-label={`One more ${item.item_name}`} onClick={() => increase(item)}><Plus size={16} /></button>
                  </div>
                  <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 700 }}>₹{(item.selling_price * item.quantity).toFixed(2)}</div>
                  <button style={{ ...qtyBtn, color: 'var(--secondary-color)' }} aria-label={`Remove ${item.item_name}`} onClick={() => cart.removeAll(item.listing_id)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{cart.count} item{cart.count === 1 ? '' : 's'}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>₹{cart.total.toFixed(2)}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="auth-btn" style={{ marginTop: 0, padding: '0.7rem 1.2rem', background: 'transparent', border: '1px solid var(--text-secondary)' }} onClick={cart.clear}>Empty cart</button>
                <button className="auth-btn" style={{ marginTop: 0, padding: '0.7rem 1.6rem', opacity: cart.placing ? 0.6 : 1 }} disabled={cart.placing} onClick={handleCheckout}>
                  {cart.placing ? 'Placing order…' : 'Place order'}
                </button>
              </div>
            </div>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Each seller gets a separate order. If any item is no longer available, nothing is ordered.
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default CartPage;
