import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { SearchX, Plus } from 'lucide-react';
import Header from '../components/Header';
import HeroBanner from '../components/HeroBanner';
import CategoryList, { SAVED } from '../components/CategoryList';
import ProductCard from '../components/ProductCard';
import FloatingCart from '../components/FloatingCart';
import { AuthContext } from '../contexts/auth';
import { useCart } from '../contexts/cart';
import { useToast } from '../contexts/toast';
import useFavorites from '../hooks/useFavorites';
import api from '../utils/api';

const SkeletonCard = () => (
  <div className="product-skeleton" aria-hidden="true">
    <div className="skeleton-block" style={{ height: 18, width: '40%', marginLeft: 'auto' }} />
    <div className="skeleton-block" style={{ aspectRatio: '4 / 3' }} />
    <div className="skeleton-block" style={{ height: 16, width: '75%' }} />
    <div className="skeleton-block" style={{ height: 12, width: '50%' }} />
    <div className="skeleton-block" style={{ height: 32, width: '45%' }} />
  </div>
);

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, logout } = useContext(AuthContext);
  const cart = useCart();
  const toast = useToast();
  const favorites = useFavorites();
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

  // "Saved" filter disappears once nothing is saved
  useEffect(() => {
    if (selectedCategory === SAVED && favorites.ids.length === 0) setSelectedCategory(null);
  }, [favorites.ids.length, selectedCategory]);

  const handleAddToCart = (product) => {
    const error = cart.add(product);
    if (error) toast(error, 'error');
  };

  const handleCheckout = async () => {
    try {
      const result = await cart.checkout();
      if (!result) return;   // already placing
      toast(result.message || 'Order placed!');
      setTimeout(() => navigate('/orders'), 900);
    } catch (err) {
      toast(err.response?.data?.message || 'Error placing order', 'error');
      fetchProducts(); // stock may have changed — refresh what's available
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === SAVED
      ? favorites.isFavorite(p.listing_id)
      : selectedCategory ? p.category_name === selectedCategory : true;
    const matchesSearch = query
      ? p.item_name.toLowerCase().includes(query) || p.seller_name.toLowerCase().includes(query)
      : true;
    return matchesCategory && matchesSearch;
  });

  const categoryLabel = selectedCategory === SAVED ? 'Saved' : selectedCategory;
  const title = query ? `Results for “${searchQuery.trim()}”` : categoryLabel ? categoryLabel : 'Popular near you';
  const emptyMessage = query
    ? `Nothing matches “${searchQuery.trim()}”${categoryLabel ? ` in ${categoryLabel}` : ''}.`
    : selectedCategory === SAVED ? 'Tap the heart on a listing to save it here.'
      : selectedCategory ? `Nobody is selling ${selectedCategory} right now.`
        : 'No listings yet. Be the first to sell something!';

  return (
    <>
      <Header user={user} onLogout={logout} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="main-content">
        <HeroBanner hostelName={user?.hostel_name} listingCount={products.length} />

        <section className="products-section" aria-labelledby="listings-title">
          <div className="section-header">
            <motion.h3 id="listings-title" className="section-title" key={title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {title}
            </motion.h3>
            {(selectedCategory || query) && (
              <button className="view-all-btn" onClick={() => { setSelectedCategory(null); setSearchQuery(''); }}>view all</button>
            )}
          </div>

          <CategoryList
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            savedCount={favorites.ids.length}
          />

          {loading ? (
            <div className="products-grid">
              {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <LayoutGroup>
              <motion.div layout className="products-grid">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product, i) => (
                    <ProductCard
                      key={product.listing_id}
                      index={i}
                      product={{ ...product, priority: product.priority_rank === 0 ? 'Same Floor' : 'Other Floor' }}
                      onAdd={handleAddToCart}
                      onRemove={(p) => cart.remove(p.listing_id)}
                      cartQuantity={cart.quantityOf(product.listing_id)}
                      isOwn={Number(product.seller_id) === Number(user?.student_id)}
                      isFavorite={favorites.isFavorite(product.listing_id)}
                      onToggleFavorite={favorites.toggle}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
              <AnimatePresence>
                {filteredProducts.length === 0 && (
                  <motion.div className="empty-state" style={{ marginTop: '0.5rem' }}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="empty-state-icon" aria-hidden="true"><SearchX size={22} /></div>
                    <p>{emptyMessage}</p>
                    {query && (
                      <button className="btn btn-primary" style={{ marginTop: '0.75rem' }}
                        onClick={() => navigate(`/seller?new_item=${encodeURIComponent(searchQuery.trim())}`)}>
                        <Plus size={16} /> Have “{searchQuery.trim()}”? Sell it
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </LayoutGroup>
          )}
        </section>
      </main>

      <FloatingCart count={cart.count} total={cart.total} placing={cart.placing} onCheckout={handleCheckout} onView={() => navigate('/cart')} />
    </>
  );
};

export default HomePage;
