import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import { AuthContext } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';

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

  const sellers = new Set(cart.items.map(i => i.seller_name)).size;

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <main className="page page-narrow">
        <div className="page-header">
          <div>
            <h1 className="page-title">Your cart</h1>
            {cart.items.length > 0 && (
              <p className="page-subtitle">{cart.count} item{cart.count === 1 ? '' : 's'} from {sellers} seller{sellers === 1 ? '' : 's'}</p>
            )}
          </div>
          {cart.items.length > 0 && (
            <button className="btn btn-link danger" onClick={() => { if (window.confirm('Remove everything from your cart?')) cart.clear(); }}>Empty cart</button>
          )}
        </div>

        {cart.items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={22} />}
            title="Your cart is empty"
            text="Add snacks, drinks or essentials from students in your hostel."
            action={<button className="btn btn-primary" onClick={() => navigate('/')}>Browse listings</button>}
          />
        ) : (
          <div className="stack">
            <div className="stack" style={{ gap: '0.6rem' }}>
              {cart.items.map(item => (
                <div key={item.listing_id} className="card listing-row">
                  {item.photo_url
                    ? <img className="listing-thumb" src={item.photo_url} alt="" />
                    : <div className="listing-thumb" aria-hidden="true">{item.item_name.charAt(0)}</div>}
                  <div className="listing-row-body">
                    <div className="listing-row-name">{item.item_name}</div>
                    <div className="listing-row-facts">
                      <span>{item.seller_name}</span>
                      <span>₹{item.selling_price.toFixed(2)} each</span>
                    </div>
                  </div>
                  <div className="listing-row-actions" style={{ alignItems: 'center', gap: '0.5rem' }}>
                    <div className="row" style={{ gap: '0.35rem', flexWrap: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" aria-label={`One less ${item.item_name}`} onClick={() => cart.remove(item.listing_id)}><Minus size={14} /></button>
                      <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }} aria-live="polite">{item.quantity}</span>
                      <button className="btn btn-ghost btn-sm" aria-label={`One more ${item.item_name}`} onClick={() => increase(item)}><Plus size={14} /></button>
                    </div>
                    <span style={{ minWidth: 70, textAlign: 'right', fontWeight: 700 }}>₹{(item.selling_price * item.quantity).toFixed(2)}</span>
                    <button className="btn btn-link danger btn-sm" aria-label={`Remove ${item.item_name}`} onClick={() => cart.removeAll(item.listing_id)}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="card card-lg">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Total</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{cart.total.toFixed(2)}</span>
              </div>
              <p className="muted small" style={{ margin: '0.5rem 0 1rem' }}>
                Each seller gets a separate order; if any item is no longer available, nothing is ordered.
              </p>
              <button className="btn btn-primary btn-block" disabled={cart.placing} onClick={handleCheckout}>
                {cart.placing ? 'Placing order…' : `Place order · ₹${cart.total.toFixed(2)}`}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default CartPage;
