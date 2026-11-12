import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import HeroBanner from '../components/HeroBanner';
import CategoryList from '../components/CategoryList';
import ProductCard from '../components/ProductCard';
import FloatingCart from '../components/FloatingCart';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 3000);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const [listingsRes, itemsRes] = await Promise.all([
        api.get('/listings'),
        api.get('/listings/items')
      ]);
      
      const itemCatMap = {};
      if (itemsRes.data) {
        itemsRes.data.forEach(item => {
          itemCatMap[item.item_name] = item.category_name;
        });
      }

      const enrichedListings = listingsRes.data.map(listing => ({
        ...listing,
        category_name: itemCatMap[listing.item_name] || 'Other'
      }));

      setProducts(enrichedListings);
    } catch (err) {
      console.error('Failed to fetch listings', err);
    }
  };

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.listing_id === product.listing_id);
      if (existing) {
        if (existing.quantity >= product.quantity_available) {
          showNotification(`Only ${product.quantity_available} units available in stock!`, 'error');
          return prev;
        }
        return prev.map(item => 
          item.listing_id === product.listing_id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.quantity_available < 1) {
        showNotification(`This item is out of stock!`, 'error');
        return prev;
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.listing_id === product.listing_id);
      if (!existing) return prev;
      if (existing.quantity === 1) {
        return prev.filter(item => item.listing_id !== product.listing_id);
      }
      return prev.map(item => 
        item.listing_id === product.listing_id 
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  };

  const handleCheckout = async () => {
    try {
      // One request, one database transaction: all items are ordered or none are
      const res = await api.post('/orders/checkout', {
        items: cartItems.map(item => ({ listing_id: item.listing_id, quantity: item.quantity }))
      });
      showNotification(res.data.message || 'Order(s) placed successfully!');
      setCartItems([]);
      setTimeout(() => navigate('/orders'), 1500);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Error placing order', 'error');
      fetchProducts(); // stock may have changed — refresh what's available
    }
  };

  const totalCartItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory 
      ? p.category_name.toLowerCase().includes(selectedCategory.toLowerCase()) || selectedCategory.toLowerCase().includes(p.category_name.toLowerCase())
      : true;
      
    const matchesSearch = searchQuery
      ? p.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.seller_name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
      
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <Header 
        cartCount={totalCartItems} 
        user={user} 
        onLogout={logout} 
        onOrdersClick={() => navigate('/orders')} 
        onSellerClick={() => navigate('/seller')} 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      
      {notification.message && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: notification.type === 'error' ? 'var(--secondary-color)' : 'var(--primary-color)',
          color: notification.type === 'error' ? 'white' : 'black',
          padding: '1rem 2rem', borderRadius: '30px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {notification.message}
        </div>
      )}
      
      <main className="main-content">
        <HeroBanner />
        <CategoryList selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        
        <div className="products-section">
          <div className="section-header">
            <h3 className="section-title">{selectedCategory ? `${selectedCategory} near you` : `Trending on Floor ${user?.floor_id}`}</h3>
            <button className="view-all-btn" onClick={() => setSelectedCategory(null)}>View All</button>
          </div>
          
          <div className="products-grid">
            {filteredProducts.length === 0 ? (
              <p>No listings found in this category.</p>
            ) : (
              filteredProducts.map(product => {
                const cartItem = cartItems.find(item => item.listing_id === product.listing_id);
                return (
                  <ProductCard 
                    key={product.listing_id} 
                    product={{
                      ...product, 
                      priority: product.priority_rank === 0 ? 'Same Floor' : 'Other Floor'
                    }} 
                    onAdd={handleAddToCart}
                    onRemove={handleRemoveFromCart}
                    cartQuantity={cartItem ? cartItem.quantity : 0}
                  />
                );
              })
            )}
          </div>
        </div>
      </main>
      
      {/* We pass a custom checkout handler to the FloatingCart. Let's update FloatingCart to accept it */}
      <FloatingCart cartItems={cartItems} onCheckout={handleCheckout} />
    </>
  );
};

export default HomePage;
