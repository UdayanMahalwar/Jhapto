import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import HeroBanner from '../components/HeroBanner';
import CategoryList from '../components/CategoryList';
import ProductCard from '../components/ProductCard';
import FloatingCart from '../components/FloatingCart';
import { AuthContext } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import api from '../utils/api';

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, logout } = useContext(AuthContext);
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const fetchProducts = async () => {
    try {
      const [listingsRes, categoriesRes] = await Promise.all([
        api.get('/listings'),
        api.get('/listings/categories'),
      ]);
      setProducts(listingsRes.data);
      setCategories(categoriesRes.data);
    } catch (err) {
      console.error('Failed to fetch listings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleAddToCart = (product) => {
    const error = cart.add(product);
    if (error) toast(error, 'error');
  };

  const handleCheckout = async () => {
    try {
      const result = await cart.checkout();
      if (!result) return;   // already placing
      toast(result.message || 'Order placed!');
      setTimeout(() => navigate('/orders'), 1200);
    } catch (err) {
      toast(err.response?.data?.message || 'Error placing order', 'error');
      fetchProducts(); // stock may have changed — refresh what's available
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory ? p.category_name === selectedCategory : true;
    const matchesSearch = query
      ? p.item_name.toLowerCase().includes(query) || p.seller_name.toLowerCase().includes(query)
      : true;
    return matchesCategory && matchesSearch;
  });

  const emptyMessage = query
    ? `No listings match "${searchQuery.trim()}"${selectedCategory ? ` in ${selectedCategory}` : ''}.`
    : selectedCategory
      ? `Nobody is selling ${selectedCategory} right now.`
      : 'No listings yet. Be the first to sell something!';

  const floorLabel = user?.floor_number ?? user?.floor_id;

  return (
    <>
      <Header
        user={user}
        onLogout={logout}
        onOrdersClick={() => navigate('/orders')}
        onSellerClick={() => navigate('/seller')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="main-content">
        <HeroBanner />
        <CategoryList categories={categories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />

        <div className="products-section">
          <div className="section-header">
            <h3 className="section-title">
              {query ? `Results for "${searchQuery.trim()}"` : selectedCategory ? `${selectedCategory} near you` : `Trending on Floor ${floorLabel}`}
            </h3>
            {(selectedCategory || query) && (
              <button className="view-all-btn" onClick={() => { setSelectedCategory(null); setSearchQuery(''); }}>View All</button>
            )}
          </div>

          <div className="products-grid">
            {loading ? (
              <p style={{ opacity: 0.7 }}>Loading listings…</p>
            ) : filteredProducts.length === 0 ? (
              <p>{emptyMessage}</p>
            ) : (
              filteredProducts.map(product => (
                <ProductCard
                  key={product.listing_id}
                  product={{ ...product, priority: product.priority_rank === 0 ? 'Same Floor' : 'Other Floor' }}
                  onAdd={handleAddToCart}
                  onRemove={(p) => cart.remove(p.listing_id)}
                  cartQuantity={cart.quantityOf(product.listing_id)}
                  isOwn={Number(product.seller_id) === Number(user?.student_id)}
                />
              ))
            )}
          </div>
        </div>
      </main>

      <FloatingCart count={cart.count} total={cart.total} placing={cart.placing} onCheckout={handleCheckout} onView={() => navigate('/cart')} />
    </>
  );
};

export default HomePage;
