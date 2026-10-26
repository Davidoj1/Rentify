import React, {
createContext,
useContext,
useEffect,
useState
} from 'react';
import { createRoot } from 'react-dom/client';
import {
Search,
Menu,
User,
MapPin,
Star,
Heart,
ShieldCheck,
MessageCircle,
PlusCircle,
LogOut,
X,
Share2,
Edit3,
Trash2,
FileText,
Repeat2,
ArrowRight
} from 'lucide-react';
import './styles.css';

const API =
import.meta.env.VITE_API_URL ||
'http://localhost:5000/api';

const money = n =>
new Intl.NumberFormat('en-NG', {
style: 'currency',
currency: 'NGN',
maximumFractionDigits: 0
}).format(n || 0);

const AuthCtx = createContext(null);

function useAuth() {
return useContext(AuthCtx);
}

async function api(path, opts = {}) {
const token = localStorage.getItem('rentify_token');

const res = await fetch(API + path, {
...opts,
headers: {
'Content-Type': 'application/json',
...(token
? {
Authorization: `Bearer ${token}`
}
: {}),
...(opts.headers || {})
}
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
throw new Error(
data.message || 'Something went wrong'
);
}

return data;
}

function AuthProvider({ children }) {
const [user, setUser] = useState(
JSON.parse(
localStorage.getItem('rentify_user') || 'null'
)
);

const [activeMode, setActiveMode] = useState(
localStorage.getItem('rentify_active_mode') ||
  (user?.activeMode === 'hosting' ? 'owner' : 'renter')
);

useEffect(() => {
  if (!user) {
    setActiveMode('renter');
    localStorage.removeItem('rentify_active_mode');
    return;
  }

  const legacyOwner =
    user.role === 'owner' &&
    (!Array.isArray(user.roles) || user.roles.length === 0);

  if (legacyOwner) {
    api('/account/normalize-legacy-owner', { method: 'POST' })
      .then(res => {
        if (res.user) updateUser(res.user);
      })
      .catch(error => {
        console.error('Legacy owner migration failed:', error);
      });
  }

  const savedMode = localStorage.getItem('rentify_active_mode');
  const roles = Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.role || 'renter'];
  const canHost = user.role === 'owner' || user.role === 'admin' || roles.includes('owner');
  const canRent = roles.includes('renter') || user.role === 'renter';
  const accountMode = user.activeMode === 'hosting' && canHost
    ? 'owner'
    : 'renter';

  const normalized =
    savedMode === 'owner' && canHost
      ? 'owner'
      : savedMode === 'renter' && canRent
        ? 'renter'
        : accountMode;

  setActiveMode(normalized);
  localStorage.setItem('rentify_active_mode', normalized);
}, [user]);

const login = (u, t) => {
localStorage.setItem(
'rentify_user',
JSON.stringify(u)
);

localStorage.setItem(
  'rentify_token',
  t
);

const mode =
  u?.activeMode === 'hosting'
    ? 'owner'
    : u?.activeMode === 'renting'
      ? 'renter'
      : u?.role === 'owner'
        ? 'owner'
        : 'renter';

localStorage.setItem('rentify_active_mode', mode);
setActiveMode(mode);
setUser(u);
};

const updateUser = updatedUser => {
localStorage.setItem(
'rentify_user',
JSON.stringify(updatedUser)
);
setUser(updatedUser);
};

const switchMode = async mode => {
  if (!user) return false;

  const next = mode === 'owner' ? 'owner' : 'renter';
  const backendMode = next === 'owner' ? 'hosting' : 'renting';

  const roles = Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.role || 'renter'];
  const canHost = user.role === 'owner' || user.role === 'admin' || roles.includes('owner');
  const canRent = roles.includes('renter') || user.role === 'renter';

  if (next === 'owner' && !canHost) {
    return false;
  }

  if (next === 'renter' && !canRent) {
    return false;
  }

  try {
    const res = await api('/account/mode', {
      method: 'POST',
      body: JSON.stringify({ mode: backendMode })
    });

    const updatedUser = res.user || {
      ...user,
      activeMode: backendMode
    };

    localStorage.setItem(
      'rentify_active_mode',
      next
    );

    localStorage.setItem(
      'rentify_user',
      JSON.stringify(updatedUser)
    );

    setActiveMode(next);
    setUser(updatedUser);

    return true;
  } catch (error) {
    console.error('Mode switch failed:', error);
    return false;
  }
};

const logout = () => {
localStorage.removeItem('rentify_user');
localStorage.removeItem('rentify_token');
localStorage.removeItem('rentify_active_mode');
setUser(null);
setActiveMode('renter');
location.hash = '#/';
};

return (
<AuthCtx.Provider
value={{
user,
login,
updateUser,
activeMode,
switchMode,
logout
}}
>
{children}
</AuthCtx.Provider>
);
}

function useRoute() {
const [hash, setHash] = useState(
location.hash || '#/'
);

useEffect(() => {
const f = () =>
setHash(location.hash || '#/');

addEventListener('hashchange', f);

return () =>
  removeEventListener('hashchange', f);

}, []);

return hash.slice(1);
}

function go(path) {
location.hash = '#' + path;
scrollTo(0, 0);
}

function imageFallback(e) {
e.currentTarget.src =
'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900';
}

function Layout({ children }) {
const { user, logout, activeMode, switchMode } = useAuth();

const [open, setOpen] = useState(false);

// Keep the drawer scrollable independently from the page behind it.
useEffect(() => {
  if (!open) return;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = previousOverflow;
  };
}, [open]);

const nav = path => {
go(path);
setOpen(false);
};

return (
<> <header className="topbar">
<div
className="brand"
onClick={() => go('/')}
>
Rentify<span>.ng</span> </div>

    <button
      className="icon"
      onClick={() => go('/listings')}
      aria-label="Search listings"
    >
      <Search size={21} />
    </button>

    <button
      className="icon"
      onClick={() =>
        user
          ? go('/profile')
          : go('/auth')
      }
      aria-label="Account"
    >
      <User size={21} />
    </button>

    <button
      className="icon"
      onClick={() => setOpen(true)}
      aria-label="Open menu"
    >
      <Menu size={24} />
    </button>
  </header>

  <div className="beta">
    🚧 Rentify is in private beta. Complete
    bookings through Rentify for safety and
    support.
  </div>

  {open && (
    <div className="drawer">
      <style>{`
        .drawer .panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(86vw, 380px);
          height: 100vh;
          height: 100dvh;
          max-height: none !important;
          box-sizing: border-box;
          padding: 28px 20px 22px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          background: #fff;
          box-shadow: -18px 0 48px rgba(15, 23, 42, .16);
        }
        .drawer .panel h2 {
          margin: 30px 0 12px;
          font-size: 22px;
          line-height: 1.25;
          font-weight: 850;
          letter-spacing: -.035em;
          color: #111827;
        }
        .drawer .panel > a {
          width: 100%;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          min-height: 48px;
          box-sizing: border-box;
          padding: 12px 14px;
          border-radius: 13px;
          background: #f7f9fb;
          color: #172033;
          font-size: 15px;
          line-height: 1.35;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: background .15s ease, transform .15s ease;
        }
        .drawer .panel > a:active { background: #e8f4f2; transform: scale(.99); }
        .drawer .panel > button:not(.close) {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 48px;
          margin-top: auto;
          padding: 13px 16px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 800;
        }
        .drawer .panel > .close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f1f5f9;
          color: #172033;
        }
        @media (max-width: 699px) {
          .drawer .panel { width: min(86vw, 380px); padding: 26px 20px max(24px, env(safe-area-inset-bottom)); gap: 11px; }
          .drawer .panel h2 { margin-top: 34px; margin-bottom: 12px; font-size: 24px; }
          .drawer .panel > a { min-height: 50px; width: 100%; padding: 14px 16px; font-size: 16px; font-weight: 750; }
          .drawer .panel > button:not(.close) { min-height: 50px; margin-top: auto; }
        }
        @media (min-width: 700px) {
          .drawer .panel { width: 360px; padding-left: 24px; padding-right: 24px; }
        }
      `}</style>
      <div
        className="shade"
        onClick={() => setOpen(false)}
      />

      <nav
        className="panel"
        style={{ zIndex: 2 }}
      >
        <button
          className="close"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X />
        </button>

        <h2>Rentify</h2>

        <a onClick={() => nav('/')}>
          Home
        </a>

        <a onClick={() => nav('/listings')}>
          Explore listings
        </a>

        {user && (
          <a onClick={() => nav('/profile')}>
            My profile
          </a>
        )}

        {user?.role === 'owner' && (
          <div style={{ margin: '4px 0 8px', padding: 10, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Account mode
            </div>
            {Array.isArray(user.roles) && user.roles.includes('renter') ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#ffffff', padding: 4, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <button type="button" onClick={async () => { const switched = await switchMode('renter'); if (switched) nav('/dashboard'); }} style={{ border: 'none', borderRadius: 9, padding: '9px 8px', fontWeight: 800, cursor: 'pointer', background: activeMode === 'renter' ? '#ccfbf1' : 'transparent', color: activeMode === 'renter' ? '#115e59' : '#64748b' }}>
                  Renting
                </button>
                <button type="button" onClick={async () => { const switched = await switchMode('owner'); if (switched) nav('/owner'); }} style={{ border: 'none', borderRadius: 9, padding: '9px 8px', fontWeight: 800, cursor: 'pointer', background: activeMode === 'owner' ? '#0f766e' : 'transparent', color: activeMode === 'owner' ? '#ffffff' : '#64748b' }}>
                  Hosting
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Hosting account</div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>Renting is not enabled on this account yet.</p>
              </div>
            )}
          </div>
        )}

        {user && activeMode === 'owner' ? (
          <>
            <a onClick={() => nav('/owner')}>Hosting dashboard</a>
            <a onClick={() => nav('/create')}>Create listing</a>
            {Array.isArray(user.roles) && !user.roles.includes('renter') && (
              <a onClick={() => nav('/become-renter')}>Start renting</a>
            )}
          </>
        ) : user ? (
          <a onClick={() => nav('/dashboard')}>My bookings</a>
        ) : null}

        <a onClick={() => nav('/about')}>
          About Rentify
        </a>

        <a onClick={() => nav('/safety')}>
          Safety
        </a>

        <a onClick={() => nav('/terms')}>
          Terms
        </a>

        {user ? (
          <button
            className="ghost"
            onClick={logout}
          >
            <LogOut size={16} />
            Logout
          </button>
        ) : (
          <button
            onClick={() => nav('/auth')}
          >
            Sign in
          </button>
        )}
      </nav>
    </div>
  )}

  <main>{children}</main>

  <footer>
    <b>Rentify © 2026</b>

    <span>
      Connecting renters and owners across
      Nigeria.
    </span>

    <span>
      support@rentify.ng
    </span>

    <button
      className="footer-link"
      onClick={() => go('/about')}
    >
      About
    </button>

    <button
      className="footer-link"
      onClick={() => go('/safety')}
    >
      Safety
    </button>

    <button
      className="footer-link"
      onClick={() => go('/terms')}
    >
      Terms
    </button>
  </footer>
</>
);
}

function Home() {
const [q, setQ] = useState('');

const cats = [
'All',
'Shortlet Apartments',
'Vehicles',
'Equipment',
'Warehouses',
'Event Spaces/Centers',
'Others'
];

return ( <div> <section className="hero"> <div> <p className="eyebrow">
Nigeria’s smart rental marketplace </p>

      <h1>
        Find it. Rent it. Love it.
      </h1>

      <p>
        Rent apartments, cars, generators,
        warehouses and event items from
        verified owners across Nigeria.
      </p>

      <div className="searchbox">
        <Search />

        <input
          value={q}
          onChange={e =>
            setQ(e.target.value)
          }
          placeholder="Search Lekki apartment, Camry, generator..."
        />

        <button
          onClick={() =>
            go(
              '/listings?q=' +
                encodeURIComponent(q)
            )
          }
        >
          Search
        </button>
      </div>
    </div>

    <div className="hero-card">
      <ShieldCheck />

      <h3>Beta-ready marketplace</h3>

      <p>
        ₦ pricing, booking protection,
        image upload, sharing and
        mobile-first UX.
      </p>
    </div>
  </section>

  <section className="section">
    <h2>Browse categories</h2>

    <div className="catgrid">
      {cats.slice(1).map(c => (
        <button
          key={c}
          className="cat"
          onClick={() =>
            go(
              '/listings?category=' +
                encodeURIComponent(c)
            )
          }
        >
          {c}
        </button>
      ))}
    </div>
  </section>

  <Listings embedded />
</div>
);
}

function Listings({ embedded = false }) {
  const route = useRoute();
  const { user } = useAuth();

  const params = new URLSearchParams(
    route.split('?')[1] || ''
  );

  const [listings, setListings] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [category, setCategory] = useState(
    params.get('category') || 'All'
  );

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [err, setErr] = useState('');

  const cats = [
    'All',
    'Shortlet Apartments',
    'Vehicles',
    'Equipment',
    'Warehouses',
    'Event Spaces/Centers',
    'Others'
  ];

  const load = () =>
    api(
      `/listings?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`
    )
      .then(d => {
        setListings(d.listings || []);
        setErr('');
        setShowSuggestions(false);
      })
      .catch(e =>
        setErr(e.message || 'Could not load listings.')
      );

  useEffect(() => {
    load();
  }, [category]);

  useEffect(() => {
    const searchText = q.trim();

    if (embedded || searchText.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      api(
        `/listings?q=${encodeURIComponent(searchText)}&category=${encodeURIComponent(category)}`
      )
        .then(d => {
          setSuggestions(
            (d.listings || []).slice(0, 5)
          );
        })
        .catch(() => {
          setSuggestions([]);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [q, category, embedded]);

  const selectSuggestion = listing => {
    setShowSuggestions(false);
    setSuggestions([]);
    go('/listing/' + listing.id);
  };

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>
            {embedded
              ? 'Featured rentals'
              : 'Explore rentals'}
          </h2>

          <p>
            Nigerian listings with transparent daily pricing.
          </p>
        </div>

        {!embedded && (
          <button
            onClick={() =>
              go(user ? '/become-owner' : '/auth')
            }
          >
            <PlusCircle size={17} />
            List yours
          </button>
        )}
      </div>

      <div className="filters">
        <div className="listing-search">
          <input
            value={q}
            onFocus={() => setShowSuggestions(true)}
            onChange={e => {
              setQ(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                load();
              }

              if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search by item, city or category"
            autoComplete="off"
            aria-label="Search available rentals"
          />

          {!embedded &&
            showSuggestions &&
            q.trim().length >= 2 && (
              <div className="listing-suggestions">
                {suggestions.length > 0 ? (
                  suggestions.map(listing => (
                    <button
                      type="button"
                      className="listing-suggestion"
                      key={listing.id}
                      onClick={() =>
                        selectSuggestion(listing)
                      }
                    >
                      <img
                        src={listing.images?.[0]}
                        onError={imageFallback}
                        alt=""
                      />

                      <span className="suggestion-info">
                        <strong>
                          {listing.title}
                        </strong>

                        <small>
                          <MapPin size={12} />
                          {listing.location}
                        </small>
                      </span>

                      <strong className="suggestion-price">
                        {money(listing.price)}/day
                      </strong>
                    </button>
                  ))
                ) : (
                  <div className="suggestion-empty">
                    No matching listings found.
                  </div>
                )}
              </div>
            )}
        </div>

        <button onClick={load}>
          Search
        </button>
      </div>

      <div className="tabs">
        {cats.map(c => (
          <button
            className={category === c ? 'active' : ''}
            onClick={() => setCategory(c)}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>

      {err && (
        <p className="error">{err}</p>
      )}

      <div className="grid">
        {listings.map(l => (
          <ListingCard
            l={l}
            key={l.id}
          />
        ))}
      </div>

      {!listings.length && (
        <div className="empty">
          No listings found. Try another search or category.
        </div>
      )}
    </section>
  );
}


function ListingCard({ l }) {
return (
<article
className="card"
onClick={() =>
go('/listing/' + l.id)
}
>
<img
src={l.images?.[0]}
onError={imageFallback}
alt={l.title || 'Rental listing'}
/>

  <div className="card-body">
    <div className="row">
      <b>{l.title}</b>

      <span>
        <Star size={14} />
        {l.rating || 'New'}
      </span>
    </div>

    <p>
      <MapPin size={14} />
      {l.location}
    </p>

    <div className="row">
      <strong>
        {money(l.price)}/day
      </strong>

      <Heart size={18} />
    </div>
  </div>
</article>

);
}

async function shareListing(listing) {
const url =
`${location.origin}${location.pathname}` +
`#/listing/${listing.id}`;

const text =
`Check this on Rentify.ng: ${listing.title} — ` +
`${money(listing.price)}/day in ${listing.location}`;

try {
if (navigator.share) {
await navigator.share({
title: listing.title,
text,
url
});
} else {
await navigator.clipboard.writeText(
`${text}\n${url}`
);

  alert(
    'Listing link copied. You can paste it on WhatsApp.'
  );
}

} catch {}
}

function ListingDetail({ id }) {
const { user } = useAuth();

const [data, setData] =
useState(null);

const [err, setErr] =
useState('');

const [start, setStart] =
useState('');

const [end, setEnd] =
useState('');

const [loading, setLoading] =
useState(false);

useEffect(() => {
  api('/listings/' + id)
    .then(d => {
      setData(d);

      const pendingRaw = localStorage.getItem(
        'rentify_pending_booking'
      );

      if (!pendingRaw) return;

      try {
        const pending = JSON.parse(pendingRaw);

        if (String(pending.listingId) === String(id)) {
          if (pending.startDate) {
            setStart(pending.startDate);
          }

          if (pending.endDate) {
            setEnd(pending.endDate);
          }

          localStorage.removeItem(
            'rentify_pending_booking'
          );
        }
      } catch {
        localStorage.removeItem(
          'rentify_pending_booking'
        );
      }
    })
    .catch(e =>
      setErr(e.message)
    );
}, [id]);

if (err) {
return ( <section className="section">
<button
className="back-btn"
onClick={() =>
go('/listings')
}
>
← Back to listings </button>

    <p className="error">
      {err}
    </p>
  </section>
);

}

if (!data) {
return ( <section className="section">
<button
className="back-btn"
onClick={() =>
go('/listings')
}
>
← Back to listings </button>

    <p>Loading...</p>
  </section>
);

}

const {
listing,
reviews = []
} = data;

const days =
start && end
? Math.max(
1,
Math.ceil(
(new Date(end) -
new Date(start)) /
86400000
)
)
: 1;

const subtotal =
listing.price * days;

const fee = Math.round(
subtotal * 0.04
);

const total =
subtotal + fee;

const canEdit =
user &&
(user.id === listing.ownerId ||
user.role === 'admin');

async function book() {
if (!start || !end) {
  return setErr(
    'Please select start and end dates.'
  );
}

if (
  new Date(end) <=
  new Date(start)
) {
  return setErr(
    'End date must be after the start date.'
  );
}

if (!user) {
  localStorage.setItem(
    'rentify_pending_booking',
    JSON.stringify({
      listingId: id,
      startDate: start,
      endDate: end
    })
  );

  return go('/auth');
}

setLoading(true);
setErr('');

try {
  /*
   * STEP 1:
   * Create the booking and initialize
   * the Paystack transaction.
   *
   * We do NOT verify the payment here.
   * The renter must first complete
   * payment on Paystack.
   */

  const res = await api(
    '/bookings',
    {
      method: 'POST',
      body: JSON.stringify({
        listingId: id,
        startDate: start,
        endDate: end
      })
    }
  );

  /*
   * STEP 2:
   * Paystack returns authorization_url.
   * Redirect the renter to Paystack checkout.
   */

  const paymentUrl =
    res?.payment?.authorization_url;

  if (!paymentUrl) {
    throw new Error(
      'Paystack did not return a payment checkout URL.'
    );
  }

  window.location.href =
    paymentUrl;
} catch (e) {
  setErr(e.message);
  setLoading(false);
}

}

return ( <section className="detail"> <div className="detail-actions">
<button
className="back-btn"
onClick={() =>
go('/listings')
}
>
← Back to listings </button>

    <button
      className="share-btn"
      onClick={() =>
        shareListing(listing)
      }
    >
      <Share2 size={17} />
      Share listing
    </button>

    {canEdit && (
      <button
        className="edit-btn"
        onClick={() =>
          go(
            '/edit/' +
              listing.id
          )
        }
      >
        <Edit3 size={17} />
        Edit listing
      </button>
    )}
  </div>

  <img
    className="cover"
    src={listing.images?.[0]}
    onError={imageFallback}
    alt={listing.title}
  />

  <div className="detail-grid">
    <div>
      <p className="eyebrow">
        {listing.category}
      </p>

      <h1>
        {listing.title}
      </h1>

      <p className="muted">
        <MapPin size={16} />
        {listing.location}
      </p>

      <p>
        {listing.description}
      </p>

      <h3>Amenities</h3>

      <div className="chips">
        {listing.amenities?.map(
          a => (
            <span key={a}>
              {a}
            </span>
          )
        )}
      </div>

      <h3>Rules</h3>

      <p className="muted">
        {listing.rules}
      </p>

      <h3>Reviews</h3>

      {reviews.length ? (
        <div
          style={{
            display: 'grid',
            gap: 12
          }}
        >
          {reviews.map(r => (
            <div
              key={r.id}
              style={{
                padding: 14,
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                background: '#ffffff'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 6
                }}
              >
                <strong>
                  {r.userName || 'Renter'}
                </strong>
                <span
                  style={{
                    color: '#f59e0b',
                    fontWeight: 800
                  }}
                >
                  {'★'.repeat(Number(r.rating) || 0)}
                  {'☆'.repeat(5 - (Number(r.rating) || 0))}
                </span>
              </div>
              <p style={{ margin: 0 }}>
                {r.comment}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          No reviews yet.
        </p>
      )}
    </div>

    <aside className="booking">
      <h2>
        {money(listing.price)}
        <small>/day</small>
      </h2>

      <p className="safe">
        For your safety, always
        complete bookings through
        Rentify.
      </p>

      <label>
        Start date

        <input
          type="date"
          value={start}
          onChange={e =>
            setStart(
              e.target.value
            )
          }
        />
      </label>

      <label>
        End date

        <input
          type="date"
          value={end}
          onChange={e =>
            setEnd(
              e.target.value
            )
          }
        />
      </label>

      <div className="price">
        <span>
          Subtotal
        </span>

        <b>
          {money(subtotal)}
        </b>

        <span>
          Introductory beta fee (4%)
        </span>

        <b>
          {money(fee)}
        </b>

        <strong>
          Total
        </strong>

        <strong>
          {money(total)}
        </strong>
      </div>

      {err && (
        <p className="error">
          {err}
        </p>
      )}

      <button
        className="wide"
        disabled={loading}
        onClick={book}
      >
        {loading
          ? 'Opening Paystack...'
          : user
            ? 'Request Booking'
            : 'Log in to book'}
      </button>

      <p className="muted">
        You will be redirected to
        Paystack to complete your
        payment securely.
      </p>

      <p className="muted">
        Messaging unlocks after booking
        intent. Owner direct contact
        details are hidden.
      </p>
    </aside>
  </div>
</section>

);
}

/*

* Paystack payment verification page.
*
* Paystack redirects the renter back to:
*
* #/payment/verify?reference=RTF-...
*
* This component reads the reference
* and asks the backend to verify the
* completed transaction with Paystack.
  */

function PaymentVerify() {
const { user } = useAuth();

const [status, setStatus] =
useState('checking');

const [message, setMessage] =
useState(
'Verifying your payment...'
);

const [booking, setBooking] =
useState(null);

useEffect(() => {
async function verify() {
const hash =
location.hash || '';

  const queryString =
    hash.includes('?')
      ? hash.split('?')[1]
      : '';

  const params =
    new URLSearchParams(
      queryString
    );

  const reference =
    params.get('reference');

  if (!reference) {
    setStatus('error');

    setMessage(
      'No payment reference was found. We could not verify this payment.'
    );

    return;
  }

  if (!user) {
    setStatus('error');

    setMessage(
      'Please sign in again so we can verify your booking.'
    );

    return;
  }

  try {
    setStatus('checking');

    setMessage(
      'Checking your Paystack payment...'
    );

    const res = await api(
      '/bookings/verify/' +
        encodeURIComponent(
          reference
        ),
      {
        method: 'POST'
      }
    );

    setBooking(res.booking);

    setStatus('success');

    setMessage(
      'Payment successful! Your booking has been confirmed.'
    );
  } catch (e) {
    setStatus('error');

    setMessage(
      e.message ||
        'Payment could not be verified.'
    );
  }
}

verify();

}, [user]);

return ( <section className="section"> <div className="info-card">
{status === 'checking' && (
<> <h1>
Checking payment... </h1>

        <p>
          {message}
        </p>

        <p className="muted">
          Please wait while Rentify
          confirms your payment with
          Paystack.
        </p>
      </>
    )}

    {status === 'success' && (
      <>
        <ShieldCheck size={40} />

        <h1>
          Payment successful 🎉
        </h1>

        <p>
          {message}
        </p>

        {booking && (
          <div className="price">
            <span>
              Booking
            </span>

            <b>
              {booking.reference}
            </b>

            <span>
              Status
            </span>

            <b>
              {booking.status}
            </b>

            <span>
              Total paid
            </span>

            <b>
              {money(
                booking.total
              )}
            </b>
          </div>
        )}

        <button
          className="wide"
          onClick={() =>
            go('/dashboard')
          }
        >
          View My Bookings
        </button>
      </>
    )}

    {status === 'error' && (
      <>
        <h1>
          Payment was not successful.
        </h1>

        <p className="error">
          {message}
        </p>

        <p className="muted">
          If you cancelled the
          Paystack payment or the
          transaction failed, you can
          return to the listing and try
          again.
        </p>

        <button
          className="wide"
          onClick={() =>
            go('/listings')
          }
        >
          Back to Listings
        </button>

        <button
          className="secondary-wide"
          onClick={() =>
            go('/dashboard')
          }
        >
          My Bookings
        </button>
      </>
    )}
  </div>
</section>

);
}

function Auth() {
const { login } = useAuth();

const [mode, setMode] =
useState('login');

const [form, setForm] =
useState({});

const [err, setErr] =
useState('');

async function submit(e) {
e.preventDefault();

setErr('');

try {
  const res = await api(
    '/auth/' +
      (mode === 'login'
        ? 'login'
        : 'signup'),
    {
      method: 'POST',
      body: JSON.stringify(form)
    }
  );

  login(
    res.user,
    res.token
  );

  const pendingRaw = localStorage.getItem(
    'rentify_pending_booking'
  );

  if (pendingRaw) {
    try {
      const pending = JSON.parse(pendingRaw);

      if (pending?.listingId) {
        go('/listing/' + pending.listingId);
        return;
      }
    } catch {
      localStorage.removeItem(
        'rentify_pending_booking'
      );
    }
  }

  go('/');
} catch (ex) {
  setErr(
    ex.message ||
      'Authentication failed.'
  );
}

}

return ( <section className="auth"> <form onSubmit={submit}> <h1>
{mode === 'login'
? 'Welcome back'
: 'Join Rentify'} </h1>

    {mode === 'signup' && (
      <input
        placeholder="Full name"
        value={form.name || ''}
        onChange={e =>
          setForm({
            ...form,
            name: e.target.value
          })
        }
      />
    )}

    <input
      placeholder="Email"
      type="email"
      value={form.email || ''}
      onChange={e =>
        setForm({
          ...form,
          email: e.target.value
        })
      }
    />

    {mode === 'signup' && (
      <input
        placeholder="Phone +234..."
        value={form.phone || ''}
        onChange={e =>
          setForm({
            ...form,
            phone: e.target.value
          })
        }
      />
    )}

    <input
      type="password"
      placeholder="Password"
      value={form.password || ''}
      onChange={e =>
        setForm({
          ...form,
          password:
            e.target.value
        })
      }
    />


    {err && (
      <p className="error">
        {err}
      </p>
    )}

    <button className="wide">
      {mode === 'login'
        ? 'Sign in'
        : 'Create account'}
    </button>

    <p
      onClick={() => {
        setMode(
          mode === 'login'
            ? 'signup'
            : 'login'
        );

        setErr('');
      }}
      className="link"
    >
      {mode === 'login'
        ? 'Create new account'
        : 'Already have an account?'}
    </p>
  </form>
</section>

);
}

function BecomeOwner() {
  const { user, updateUser, activeMode, switchMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (!user) {
    return (
      <section className="section">
        <div className="info-card" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <p className="eyebrow">List on Rentify</p>
          <h1>Turn what you own into income.</h1>
          <p className="muted">Sign in to create listings, manage bookings and connect with renters.</p>
          <button className="wide" onClick={() => go('/auth')}>
            Sign in to continue
          </button>
        </div>
      </section>
    );
  }

  if (user.role === 'owner') {
    return (
      <section className="section">
        <div className="info-card" style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#ccfbf1', color: '#0f766e', marginBottom: 14 }}>
            <Repeat2 size={25} />
          </div>
          <p className="eyebrow">Rentify modes</p>
          <h1>{activeMode === 'owner' ? 'You’re in Hosting mode.' : 'You’re in Renting mode.'}</h1>
          <p className="muted">One account gives you both experiences. Switch modes whenever you need to rent something or manage your own listings.</p>
          <button className="wide" onClick={async () => {
            const next = activeMode === 'owner' ? 'renter' : 'owner';
            const switched = await switchMode(next);
            if (switched) go(next === 'owner' ? '/owner' : '/dashboard');
          }}>
            <Repeat2 size={17} />
            Switch to {activeMode === 'owner' ? 'Renting' : 'Hosting'}
          </button>
          <button className="secondary-wide" onClick={() => go(activeMode === 'owner' ? '/create' : '/owner')}>
            {activeMode === 'owner' ? 'Create a listing' : 'Open hosting dashboard'}
          </button>
        </div>
      </section>
    );
  }

  async function becomeOwner() {
    setLoading(true);
    setErr('');
    try {
      const res = await api('/account/become-owner', { method: 'POST' });
      const updatedUser = res.user || res;
      updateUser(updatedUser);
      const switched = await switchMode('owner');

      if (!switched) {
        throw new Error('Hosting mode could not be activated.');
      }

      go('/owner');
    } catch (e) {
      setErr(e.message || 'Could not activate hosting mode.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="info-card" style={{ maxWidth: 820, margin: '0 auto', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28, alignItems: 'center' }}>
          <div>
            <p className="eyebrow">Become a Rentify owner</p>
            <h1>List what you own. Keep the same account.</h1>
            <p className="muted">You already use Rentify for renting. Activate Hosting mode to list your car, apartment, equipment or other rentable items.</p>
            <div style={{ display: 'grid', gap: 10, margin: '20px 0' }}>
              {[
                'Create and manage your listings',
                'Receive and manage booking requests',
                'Chat with renters through Rentify',
                'Track your rental activity and earnings'
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <ShieldCheck size={17} color="#0f766e" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            {err && <p className="error">{err}</p>}
            <button className="wide" disabled={loading} onClick={becomeOwner}>
              {loading ? 'Activating hosting...' : 'Become an owner'}
              {!loading && <ArrowRight size={17} />}
            </button>
          </div>
          <div style={{ padding: 22, borderRadius: 22, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b', marginBottom: 10 }}>ONE ACCOUNT</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: 15, borderRadius: 16, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <strong>Renting</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>Discover and book rentals.</p>
              </div>
              <div style={{ display: 'grid', placeItems: 'center', color: '#0f766e' }}><Repeat2 size={22} /></div>
              <div style={{ padding: 15, borderRadius: 16, background: '#0f766e', color: '#ffffff' }}>
                <strong>Hosting</strong>
                <p style={{ margin: '4px 0 0', opacity: 0.88 }}>List and manage what you own.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BecomeRenter() {
  const { user, updateUser, switchMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (!user) return null;

  const roles = Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.role || 'renter'];

  if (roles.includes('renter')) {
    return (
      <section className="section">
        <div className="info-card" style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p className="eyebrow">Renting</p>
          <h1>Renting is already enabled.</h1>
          <p className="muted">You can use the same account for both Renting and Hosting.</p>
          <button className="wide" onClick={async () => { const switched = await switchMode('renter'); if (switched) go('/dashboard'); }}>
            Start renting
          </button>
        </div>
      </section>
    );
  }

  async function enableRenting() {
    setLoading(true); setErr('');
    try {
      const res = await api('/account/enable-renting', { method: 'POST' });
      const updatedUser = res.user || res;
      updateUser(updatedUser);
      const switched = await switchMode('renter');
      if (!switched) throw new Error('Renting mode could not be activated.');
      go('/dashboard');
    } catch (e) {
      setErr(e.message || 'Could not enable renting.');
    } finally { setLoading(false); }
  }

  return (
    <section className="section">
      <div className="info-card" style={{ maxWidth: 820, margin: '0 auto' }}>
        <p className="eyebrow">Start renting</p>
        <h1>Add Renting to your Rentify account.</h1>
        <p className="muted">Keep your Hosting account and add Renting when you are ready to discover, book and pay for rentals.</p>
        <div style={{ display: 'grid', gap: 10, margin: '20px 0' }}>
          {['Browse available rentals', 'Make and pay for bookings', 'Chat with owners through Rentify', 'Keep your rental history in this account'].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9 }}><ShieldCheck size={17} color="#0f766e" /><span>{item}</span></div>
          ))}
        </div>
        {err && <p className="error">{err}</p>}
        <button className="wide" disabled={loading} onClick={enableRenting}>
          {loading ? 'Creating renter access...' : 'Create renter access'}
          {!loading && <ArrowRight size={17} />}
        </button>
        <button className="secondary-wide" onClick={() => go('/owner')}>Back to Hosting</button>
      </div>
    </section>
  );
}

function Dashboard() {
  const { activeMode } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewedIds, setReviewedIds] = useState(new Set());

  async function loadBookings() {
    try {
      setLoading(true);
      const d = await api('/bookings');
      setBookings(d.bookings || []);
      setErr('');

      const completed = (d.bookings || []).filter(
        b => b.status === 'completed'
      );

      if (completed.length) {
        const results = await Promise.all(
          completed.map(async b => {
            try {
              const r = await api('/reviews/booking/' + b.id);
              return r.review ? b.id : null;
            } catch {
              return null;
            }
          })
        );

        setReviewedIds(
          new Set(results.filter(Boolean))
        );
      } else {
        setReviewedIds(new Set());
      }
    } catch (e) {
      setErr(
        e.message ||
          'Could not load your bookings.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeMode !== 'renter') return;

    loadBookings();
  }, [activeMode]);

  function openReview(bookingId) {
    setReviewOpen(bookingId);
    setReviewRating(0);
    setReviewComment('');
    setReviewMessage('');
  }

  function closeReview() {
    if (reviewSaving) return;
    setReviewOpen('');
    setReviewRating(0);
    setReviewComment('');
    setReviewMessage('');
  }

  async function submitReview(booking) {
    if (!reviewRating) {
      setReviewMessage('Please select a rating from 1 to 5 stars.');
      return;
    }

    if (!reviewComment.trim()) {
      setReviewMessage('Please write a short review before submitting.');
      return;
    }

    setReviewSaving(true);
    setReviewMessage('');

    try {
      await api('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: booking.id,
          rating: reviewRating,
          comment: reviewComment.trim()
        })
      });

      setReviewedIds(prev => {
        const next = new Set(prev);
        next.add(booking.id);
        return next;
      });

      setReviewMessage('Review submitted successfully.');
      setReviewOpen('');
      setReviewRating(0);
      setReviewComment('');
    } catch (e) {
      setReviewMessage(
        e.message || 'Could not submit your review.'
      );
    } finally {
      setReviewSaving(false);
    }
  }

  return (
    <section className="section">
      <h1>My bookings</h1>

      <p className="muted">
        View your rental bookings and
        continue conversations with
        owners.
      </p>

      {err && (
        <p className="error">
          {err}
        </p>
      )}

      {reviewMessage && !reviewOpen && (
        <p className="safe">
          {reviewMessage}
        </p>
      )}

      {loading ? (
        <div className="empty">
          Loading your bookings...
        </div>
      ) : (
        <div className="list">
          {bookings.map(b => {
            const isCompleted =
              b.status === 'completed';
            const hasReview =
              reviewedIds.has(b.id);
            const isReviewing =
              reviewOpen === b.id;

            return (
              <div
                className="booking-row"
                key={b.id}
              >
                <img
                  src={
                    b.listing?.images?.[0]
                  }
                  onError={imageFallback}
                  alt=""
                />

                <div className="booking-info">
                  <b>
                    {b.listing?.title ||
                      'Rental booking'}
                  </b>

                  <p>
                    {b.startDate} →{' '}
                    {b.endDate}
                  </p>

                  <p>
                    {money(b.total)}
                    {' • '}
                    {String(
                      b.status || ''
                    ).replace(
                      /_/g,
                      ' '
                    )}
                  </p>

                  {b.reference && (
                    <small>
                      Ref: {b.reference}
                    </small>
                  )}

                  {isCompleted && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 14,
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc'
                      }}
                    >
                      {hasReview ? (
                        <div
                          style={{
                            fontWeight: 700,
                            color: '#0f766e'
                          }}
                        >
                          ✓ Review submitted
                        </div>
                      ) : isReviewing ? (
                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                              marginBottom: 8
                            }}
                          >
                            Rate your rental
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: 4,
                              marginBottom: 12,
                              flexWrap: 'wrap'
                            }}
                          >
                            {[1, 2, 3, 4, 5].map(
                              value => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() =>
                                    setReviewRating(value)
                                  }
                                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 2,
                                    cursor: 'pointer',
                                    color:
                                      value <= reviewRating
                                        ? '#f59e0b'
                                        : '#cbd5e1'
                                  }}
                                >
                                  <Star
                                    size={27}
                                    fill={
                                      value <= reviewRating
                                        ? 'currentColor'
                                        : 'none'
                                    }
                                  />
                                </button>
                              )
                            )}
                          </div>

                          <textarea
                            value={reviewComment}
                            onChange={e =>
                              setReviewComment(
                                e.target.value
                              )
                            }
                            placeholder="How was your rental experience?"
                            maxLength={1000}
                            rows={4}
                            style={{
                              width: '100%',
                              resize: 'vertical',
                              marginBottom: 10,
                              boxSizing: 'border-box'
                            }}
                          />

                          {reviewMessage && (
                            <p
                              className={
                                reviewMessage.includes(
                                  'successfully'
                                )
                                  ? 'safe'
                                  : 'error'
                              }
                            >
                              {reviewMessage}
                            </p>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              flexWrap: 'wrap'
                            }}
                          >
                            <button
                              type="button"
                              disabled={reviewSaving}
                              onClick={() =>
                                submitReview(b)
                              }
                            >
                              {reviewSaving
                                ? 'Submitting...'
                                : 'Submit review'}
                            </button>

                            <button
                              type="button"
                              className="secondary-wide"
                              disabled={reviewSaving}
                              onClick={closeReview}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap'
                          }}
                        >
                          <div>
                            <strong>
                              How was your rental?
                            </strong>
                            <p
                              className="muted"
                              style={{
                                margin: '4px 0 0'
                              }}
                            >
                              Your rating helps other renters.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              openReview(b.id)
                            }
                          >
                            <Star size={16} />
                            Leave a review
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() =>
                    go('/chat/' + b.id)
                  }
                >
                  <MessageCircle
                    size={16}
                  />
                  Chat
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading &&
        !bookings.length && (
          <div className="empty">
            No bookings yet.
          </div>
        )}
    </section>
  );
}

function Owner() {
const { user, activeMode, switchMode } = useAuth();

const [listings, setListings] = useState([]);
const [bookings, setBookings] = useState([]);
const [err, setErr] = useState('');
const [message, setMessage] = useState('');
const [loading, setLoading] = useState(true);
const [actionLoading, setActionLoading] = useState('');

useEffect(() => {
  if (user?.role === 'owner' && activeMode !== 'owner') {
    switchMode('owner');
  }
}, [user?.id, user?.role, activeMode]);

useEffect(() => {
  if (!user || user.role !== 'owner' || activeMode !== 'owner') return;

  setLoading(true);

  Promise.all([
    api('/listings'),
    api('/bookings')
  ])
    .then(([listingData, bookingData]) => {
      setListings(
        (listingData.listings || []).filter(
          l => l.ownerId === user.id
        )
      );
      setBookings(bookingData.bookings || []);
      setErr('');
    })
    .catch(e => {
      setErr(e.message || 'Could not load owner dashboard.');
    })
    .finally(() => setLoading(false));
}, [user?.id, user?.role, activeMode]);

if (!user || user.role !== 'owner') {
  return <BecomeOwner />;
}

if (activeMode !== 'owner') {
  return (
    <section className="section">
      <div className="info-card" style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <p className="eyebrow">Hosting mode</p>
        <h1>Your listings are waiting for you.</h1>
        <p className="muted">Switch to Hosting mode to manage your listings, bookings and renter conversations.</p>
        <button className="wide" onClick={async () => {
            const switched = await switchMode('owner');
            if (switched) go('/owner');
          }}>
          <Repeat2 size={17} />
          Switch to Hosting
        </button>
      </div>
    </section>
  );
}


const revenue =
bookings.reduce(
(sum, b) =>
sum +
([
'paid',
'confirmed',
'completed'
].includes(b.status)
? Math.max(
0,
b.total -
(b.platformFee ||
0)
)
: 0),
0
);

const paidBookings =
bookings.filter(b =>
[
'paid',
'confirmed',
'completed'
].includes(b.status)
);

function scrollToSection(id) {
document
.getElementById(id)
?.scrollIntoView({
behavior: 'smooth',
block: 'start'
});
}

function statusLabel(status) {
return String(status || '')
.replace(/_/g, ' ')
.replace(
/\b\w/g,
c => c.toUpperCase()
);
}

async function deleteListing(listingId) {
  const listing = listings.find(l => l.id === listingId);
  if (!listing) return;

  const confirmed = window.confirm(
    `Delete \"${listing.title}\"? This action cannot be undone.`
  );

  if (!confirmed) return;

  setActionLoading(`delete:${listingId}`);
  setErr('');
  setMessage('');

  try {
    await api(`/listings/${listingId}`, {
      method: 'DELETE'
    });

    setListings(prev =>
      prev.filter(l => l.id !== listingId)
    );

    setMessage('Listing deleted successfully.');
  } catch (e) {
    setErr(
      e.message ||
      'Could not delete the listing.'
    );
  } finally {
    setActionLoading('');
  }
}

async function updateBookingStatus(
bookingId,
nextStatus
) {
const booking =
bookings.find(
b => b.id === bookingId
);

if (!booking) return;

if (
nextStatus === 'cancelled' &&
!window.confirm(
'Are you sure you want to cancel this booking?'
)
) {
return;
}

setActionLoading(
`${bookingId}:${nextStatus}`
);
setErr('');
setMessage('');

try {
const res = await api(
`/bookings/${bookingId}/status`,
{
method: 'PATCH',
body: JSON.stringify({
status: nextStatus
})
}
);

const updated =
res.booking;

setBookings(prev =>
prev.map(b =>
b.id === bookingId
? updated
: b
)
);

setMessage(
nextStatus === 'confirmed'
? 'Booking confirmed successfully.'
: nextStatus === 'cancelled'
? 'Booking cancelled successfully.'
: 'Booking marked as completed successfully.'
);
} catch (e) {
setErr(
e.message ||
'Could not update the booking.'
);
} finally {
setActionLoading('');
}
}

return ( <section className="section"> <div className="section-head"> <div> <h1>
Owner dashboard </h1>

      <p>
        Manage your rentals,
        bookings and renter
        conversations.
      </p>
    </div>

    <button
      onClick={() =>
        go('/create')
      }
    >
      <PlusCircle size={17} />
      Create listing
    </button>
  </div>

  {err && (
    <p className="error">
      {err}
    </p>
  )}

  {message && (
    <p className="safe">
      {message}
    </p>
  )}

  {loading ? (
    <div className="empty">
      Loading owner dashboard...
    </div>
  ) : (
    <>
      <div className="stats">
        <div
          className="stat-card"
          role="button"
          tabIndex={0}
          onClick={() =>
            scrollToSection(
              'owner-listings'
            )
          }
          onKeyDown={e => {
            if (
              e.key === 'Enter' ||
              e.key === ' '
            ) {
              scrollToSection(
                'owner-listings'
              );
            }
          }}
        >
          <b>
            {listings.length}
          </b>

          <span>
            Listings
          </span>
        </div>

        <div
          className="stat-card"
          role="button"
          tabIndex={0}
          onClick={() =>
            scrollToSection(
              'owner-bookings'
            )
          }
          onKeyDown={e => {
            if (
              e.key === 'Enter' ||
              e.key === ' '
            ) {
              scrollToSection(
                'owner-bookings'
              );
            }
          }}
        >
          <b>
            {bookings.length}
          </b>

          <span>
            Bookings
          </span>
        </div>

        <div
          className="stat-card"
          role="button"
          tabIndex={0}
          onClick={() =>
            scrollToSection(
              'owner-bookings'
            )
          }
          onKeyDown={e => {
            if (
              e.key === 'Enter' ||
              e.key === ' '
            ) {
              scrollToSection(
                'owner-bookings'
              );
            }
          }}
        >
          <b>
            {money(revenue)}
          </b>

          <span>
            Earnings after fee
          </span>
        </div>
      </div>

      <div
        id="owner-listings"
        className="owner-list"
      >
        <div className="section-head">
          <div>
            <h2>
              Your listings
            </h2>

            <p>
              Manage the items you
              currently have on
              Rentify.
            </p>
          </div>
        </div>

        {listings.map(l => (
          <div
            className="owner-item"
            key={l.id}
          >
            <ListingCard l={l} />

            <div
              className="owner-listing-actions"
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <button
                className="edit-owner-btn"
                onClick={() =>
                  go(
                    '/edit/' +
                      l.id
                  )
                }
              >
                <Edit3 size={16} />
                Edit listing
              </button>

              <button
                className="edit-owner-btn"
                style={{
                  background: '#fff1f2',
                  color: '#dc2626',
                  borderColor: '#fecdd3'
                }}
                disabled={
                  Boolean(actionLoading)
                }
                onClick={() =>
                  deleteListing(l.id)
                }
              >
                <Trash2 size={16} />
                {actionLoading ===
                `delete:${l.id}`
                  ? 'Deleting...'
                  : 'Delete listing'}
              </button>
            </div>
          </div>
        ))}

        {!listings.length && (
          <div className="empty">
            You have not created
            any listings yet.
          </div>
        )}
      </div>

      <div
        id="owner-bookings"
        className="owner-bookings"
      >
        <div className="section-head">
          <div>
            <h2>
              Booking management
            </h2>

            <p>
              View renters, booking
              dates, payment status
              and conversations.
            </p>
          </div>
        </div>

        {!bookings.length && (
          <div className="empty">
            No booking requests
            yet.
          </div>
        )}

        <div className="list">
          {bookings.map(b => (
            <div
              className="booking-row owner-booking-row"
              key={b.id}
            >
              <img
                src={
                  b.listing
                    ?.images?.[0]
                }
                onError={
                  imageFallback
                }
                alt=""
              />

              <div className="booking-info">
                <b>
                  {b.listing
                    ?.title ||
                    'Rental booking'}
                </b>

                <p>
                  {b.startDate} →{' '}
                  {b.endDate}
                  {' • '}
                  {b.days}{' '}
                  day
                  {b.days === 1
                    ? ''
                    : 's'}
                </p>

                <p>
                  {money(b.total)}
                  {' • '}
                  {statusLabel(
                    b.status
                  )}
                </p>

                {b.renter && (
                  <div className="renter-details">
                    <strong>
                      Renter
                    </strong>

                    <span>
                      {b.renter
                        .name}

                      {b.renter
                        .verified
                        ? ' • Verified'
                        : ''}
                    </span>

                    {b.renter
                      .phone && (
                      <span>
                        {
                          b
                            .renter
                            .phone
                        }
                      </span>
                    )}

                    {b.renter
                      .email && (
                      <span>
                        {
                          b
                            .renter
                            .email
                        }
                      </span>
                    )}
                  </div>
                )}

                <small>
                  Ref:{' '}
                  {b.reference}
                </small>
              </div>

              <div className="booking-actions">
                {b.status === 'paid' && (
                  <>
                    <button
                      disabled={
                        Boolean(
                          actionLoading
                        )
                      }
                      onClick={() =>
                        updateBookingStatus(
                          b.id,
                          'confirmed'
                        )
                      }
                    >
                      {actionLoading ===
                      `${b.id}:confirmed`
                        ? 'Confirming...'
                        : 'Confirm Booking'}
                    </button>

                    <button
                      className="secondary-wide"
                      disabled={
                        Boolean(
                          actionLoading
                        )
                      }
                      onClick={() =>
                        updateBookingStatus(
                          b.id,
                          'cancelled'
                        )
                      }
                    >
                      {actionLoading ===
                      `${b.id}:cancelled`
                        ? 'Cancelling...'
                        : 'Cancel Booking'}
                    </button>
                  </>
                )}

                {b.status === 'confirmed' && (
                  <>
                    <button
                      disabled={
                        Boolean(
                          actionLoading
                        )
                      }
                      onClick={() =>
                        updateBookingStatus(
                          b.id,
                          'completed'
                        )
                      }
                    >
                      {actionLoading ===
                      `${b.id}:completed`
                        ? 'Completing...'
                        : 'Mark Completed'}
                    </button>

                    <button
                      className="secondary-wide"
                      disabled={
                        Boolean(
                          actionLoading
                        )
                      }
                      onClick={() =>
                        updateBookingStatus(
                          b.id,
                          'cancelled'
                        )
                      }
                    >
                      {actionLoading ===
                      `${b.id}:cancelled`
                        ? 'Cancelling...'
                        : 'Cancel Booking'}
                    </button>
                  </>
                )}

                {paidBookings.some(
                  paid =>
                    paid.id ===
                    b.id
                ) && (
                  <button
                    onClick={() =>
                      go(
                        '/chat/' +
                          b.id
                      )
                    }
                  >
                    <MessageCircle
                      size={16}
                    />
                    Chat
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )}
</section>
);
}

function readImageFile(file) {
return new Promise(
(resolve, reject) => {
if (!file) {
return resolve('');
}

  const reader =
    new FileReader();

  reader.onload = () =>
    resolve(
      reader.result
    );

  reader.onerror = reject;

  reader.readAsDataURL(file);
}

);
}

function CreateListing({ editId }) {
  const { user, activeMode } = useAuth();
  const isEdit = Boolean(editId);

  const [form, setForm] = useState({
    category: 'Shortlet Apartments',
    amenities: '',
    title: '',
    price: '',
    location: '',
    description: '',
    rules: ''
  });
  const [existingImages, setExistingImages] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const categories = [
    'Shortlet Apartments',
    'Vehicles',
    'Equipment',
    'Warehouses',
    'Event Spaces/Centers',
    'Others'
  ];
  const maxImages = 20;
  const maxFileSize = 10 * 1024 * 1024;

  useEffect(() => {
    if (!isEdit) return;
    api('/listings/' + editId)
      .then(data => {
        const listing = data.listing || data;
        setForm({
          category: listing.category || 'Shortlet Apartments',
          amenities: (listing.amenities || []).join(', '),
          title: listing.title || '',
          price: listing.price ?? '',
          location: listing.location || '',
          description: listing.description || '',
          rules: listing.rules || ''
        });
        setExistingImages(Array.isArray(listing.images) ? listing.images : []);
      })
      .catch(error => setErr(error.message || 'Could not load listing.'));
  }, [editId, isEdit]);

  useEffect(() => {
    const next = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(next);
    return () => next.forEach(url => URL.revokeObjectURL(url));
  }, [selectedFiles]);

  if (!user || (user.role !== 'owner' && user.role !== 'admin') || activeMode !== 'owner') {
    return <BecomeOwner />;
  }

  function handleFiles(event) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    if (!incoming.length) return;

    const valid = [];
    for (const file of incoming) {
      if (!file.type.startsWith('image/')) {
        setErr(`${file.name} is not an image file.`);
        continue;
      }
      if (file.size > maxFileSize) {
        setErr(`${file.name} is larger than 10 MB. Choose a smaller image.`);
        continue;
      }
      valid.push(file);
    }

    const slots = maxImages - existingImages.length - selectedFiles.length;
    if (valid.length > slots) {
      setErr(`You can add up to ${maxImages} images per listing.`);
    }
    setSelectedFiles(current => [...current, ...valid].slice(0, Math.max(0, slots)));
    if (valid.length && valid.length <= slots) setErr('');
  }

  function removeExistingImage(index) {
    setExistingImages(current => current.filter((_, i) => i !== index));
  }

  function removeSelectedImage(index) {
    setSelectedFiles(current => current.filter((_, i) => i !== index));
  }

  async function uploadSelectedImages() {
    if (!selectedFiles.length) return [];
    setUploading(true);
    try {
      // This endpoint is protected and returns a signed payload; the API secret stays on the server.
      const signed = await api('/cloudinary/signature', { method: 'POST' });
      if (!signed.cloudName || !signed.apiKey || !signed.timestamp || !signed.signature || !signed.folder) {
        throw new Error('Cloudinary returned incomplete upload details. Check the backend configuration.');
      }

      const uploaded = await Promise.all(selectedFiles.map(async file => {
        const payload = new FormData();
        payload.append('file', file);
        payload.append('api_key', signed.apiKey);
        payload.append('timestamp', String(signed.timestamp));
        payload.append('signature', signed.signature);
        payload.append('folder', signed.folder);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, {
          method: 'POST',
          body: payload
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.secure_url) {
          throw new Error(result.error?.message || `Could not upload ${file.name}.`);
        }
        return result.secure_url;
      }));
      return uploaded;
    } finally {
      setUploading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || uploading) return;
    setErr('');

    if (!form.title.trim() || !form.location.trim() || !form.price || !form.description.trim()) {
      setErr('Please complete the title, price, location and description fields.');
      return;
    }
    if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) {
      setErr('Enter a valid price greater than zero.');
      return;
    }
    if (existingImages.length + selectedFiles.length > maxImages) {
      setErr(`You can add up to ${maxImages} images per listing.`);
      return;
    }

    setSaving(true);
    try {
      const uploadedUrls = await uploadSelectedImages();
      const body = {
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        price: Number(form.price),
        images: [...existingImages, ...uploadedUrls],
        amenities: String(form.amenities || '').split(',').map(value => value.trim()).filter(Boolean)
      };

      await api(isEdit ? '/listings/' + editId : '/listings', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      });
      go(isEdit ? '/listing/' + editId : '/owner');
    } catch (error) {
      setErr(error.message || 'Could not save listing.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="auth">
      <form onSubmit={submit} className="bigform">
        <h1>{isEdit ? 'Edit listing' : 'Create listing'}</h1>

        <input required placeholder="Title" value={form.title}
          onChange={event => setForm(current => ({ ...current, title: event.target.value }))} />

        <select required value={form.category}
          onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
          {categories.map(category => <option key={category} value={category}>{category}</option>)}
        </select>

        <input required type="number" min="1" step="1" placeholder="Price per day e.g. 85000" value={form.price}
          onChange={event => setForm(current => ({ ...current, price: event.target.value }))} />

        <input required placeholder="Location e.g. Lekki, Lagos" value={form.location}
          onChange={event => setForm(current => ({ ...current, location: event.target.value }))} />

        <div className="upload">
          <span style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>Listing photos</span>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>
            Choose photos from your phone or computer. Up to {maxImages} images, 10 MB each.
            Photos upload securely to Cloudinary when you publish the listing.
          </p>
          <input type="file" accept="image/*" multiple onChange={handleFiles}
            disabled={existingImages.length + selectedFiles.length >= maxImages} />
        </div>

        {(existingImages.length > 0 || previews.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
            {existingImages.map((url, index) => (
              <div key={`existing-${url}-${index}`} style={{ position: 'relative' }}>
                <img src={url} alt={`Existing listing photo ${index + 1}`} className="preview-img"
                  style={{ width: '100%', height: 110, objectFit: 'cover' }} onError={imageFallback} />
                <button type="button" aria-label={`Remove existing photo ${index + 1}`}
                  onClick={() => removeExistingImage(index)}
                  style={{ position: 'absolute', top: 4, right: 4, padding: '4px 7px' }}>×</button>
              </div>
            ))}
            {previews.map((url, index) => (
              <div key={`${selectedFiles[index]?.name}-${index}`} style={{ position: 'relative' }}>
                <img src={url} alt={`Selected listing photo ${index + 1}`} className="preview-img"
                  style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                <button type="button" aria-label={`Remove selected photo ${index + 1}`}
                  onClick={() => removeSelectedImage(index)}
                  style={{ position: 'absolute', top: 4, right: 4, padding: '4px 7px' }}>×</button>
              </div>
            ))}
          </div>
        )}

        <textarea required placeholder="Description" value={form.description}
          onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />

        <input placeholder="Amenities separated by comma" value={form.amenities}
          onChange={event => setForm(current => ({ ...current, amenities: event.target.value }))} />

        <textarea placeholder="Rules / policies" value={form.rules}
          onChange={event => setForm(current => ({ ...current, rules: event.target.value }))} />

        {err && <p className="error">{err}</p>}

        <button className="wide" disabled={saving || uploading}>
          {uploading ? 'Uploading photos...' : saving ? 'Saving...' : isEdit ? 'Save changes' : 'Publish listing'}
        </button>

        {isEdit && <button type="button" className="secondary-wide" onClick={() => go('/listing/' + editId)}>Cancel</button>}
      </form>
    </section>
  );
}

function Chat({ id }) {
  const { user } = useAuth();

  const [msgs, setMsgs] = useState([]);
  const [booking, setBooking] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr('');

      const [messageData, bookingData] =
        await Promise.all([
          api('/messages/' + id),
          api('/bookings')
        ]);

      setMsgs(messageData.messages || []);

      const currentBooking =
        (bookingData.bookings || []).find(
          b => String(b.id) === String(id)
        );

      setBooking(currentBooking || null);
    } catch (e) {
      setErr(
        e.message ||
          'Could not load this conversation.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function send() {
    const message = text.trim();

    if (!message || sending) {
      return;
    }

    try {
      setSending(true);
      setErr('');

      const data = await api(
        '/messages/' + id,
        {
          method: 'POST',
          body: JSON.stringify({
            text: message
          })
        }
      );

      if (data.message) {
        setMsgs(prev => [
          ...prev,
          data.message
        ]);
      }

      setText('');
    } catch (e) {
      setErr(
        e.message ||
          'Could not send your message.'
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault();
      send();
    }
  }

  const isRenter =
    booking &&
    String(booking.renterId) ===
      String(user?.id);

  const otherParty = isRenter
    ? booking?.owner
    : booking?.renter;

  const otherPartyName =
    otherParty?.name ||
    'Other party';

  const otherPartyRole =
    otherParty?.role === 'owner'
      ? 'Owner'
      : otherParty?.role === 'renter'
        ? 'Renter'
        : '';

  const { activeMode } = useAuth();

  const backPath =
    activeMode === 'owner'
      ? '/owner'
      : '/dashboard';

  return (
    <section className="section chat">
      <button
        className="back-btn"
        onClick={() =>
          go(backPath)
        }
      >
        ← Back
      </button>

      <div className="chat-header">
        <div>
          <h1>
            {otherPartyName}
          </h1>

          {otherPartyRole && (
            <p className="muted">
              {otherPartyRole}
            </p>
          )}
        </div>
      </div>

      {booking?.listing?.title && (
        <p className="muted">
          Booking: {booking.listing.title}
        </p>
      )}

      <p className="safe">
        For your safety, do not
        share external payment
        details or move transactions
        outside Rentify.
      </p>

      {err && (
        <p className="error">
          {err}
        </p>
      )}

      <div className="chatbox">
        {loading ? (
          <p className="muted">
            Loading conversation...
          </p>
        ) : !msgs.length ? (
          <p className="muted">
            No messages yet. Start
            the conversation.
          </p>
        ) : (
          msgs.map(m => {
            if (
              m.from === 'system'
            ) {
              return (
                <p
                  key={m.id}
                  className="system"
                >
                  {m.text}
                </p>
              );
            }

            const mine =
              String(m.from) ===
              String(user?.id);

            return (
              <div
                key={m.id}
                className={
                  mine
                    ? 'bubble mine'
                    : 'bubble theirs'
                }
              >
                <small>
                  {mine
                    ? 'You'
                    : otherPartyName}
                </small>

                <div>
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="filters">
        <input
          value={text}
          onChange={e =>
            setText(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Type message..."
          disabled={sending}
        />

        <button
          onClick={send}
          disabled={
            sending ||
            !text.trim()
          }
        >
          {sending
            ? 'Sending...'
            : 'Send'}
        </button>
      </div>
    </section>
  );
}

function ProfileEditor() {
const { user, updateUser } = useAuth();

const [form, setForm] = useState({
name: user?.name || '',
email: user?.email || '',
phone: user?.phone || '',
avatar: user?.avatar || '',
bio: user?.bio || ''
});

const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [profileMessage, setProfileMessage] = useState('');
const [passwordMessage, setPasswordMessage] = useState('');
const [err, setErr] = useState('');
const [savingProfile, setSavingProfile] = useState(false);
const [savingPassword, setSavingPassword] = useState(false);

useEffect(() => {
setForm({
name: user?.name || '',
email: user?.email || '',
phone: user?.phone || '',
avatar: user?.avatar || '',
bio: user?.bio || ''
});
}, [user]);

if (!user) {
return (
<section className="section">
<div className="info-card">
<h1>My profile</h1>
<p className="muted">Please sign in to view and edit your profile.</p>
<button className="wide" onClick={() => go('/auth')}>Sign in</button>
</div>
</section>
);
}

async function handleAvatar(e) {
const file = e.target.files?.[0];
if (!file) return;

if (!file.type.startsWith('image/')) {
return setErr('Please upload a valid profile image.');
}

if (file.size > 2 * 1024 * 1024) {
return setErr('Profile image is too large. Please choose an image below 2MB.');
}

try {
const avatar = await readImageFile(file);
setForm(f => ({ ...f, avatar }));
setErr('');
setProfileMessage('');
} catch {
setErr('Could not read profile image. Please try another one.');
}
}

async function saveProfile(e) {
e.preventDefault();
setSavingProfile(true);
setErr('');
setProfileMessage('');

try {
const res = await api('/auth/profile', {
method: 'PATCH',
body: JSON.stringify({
name: form.name,
email: form.email,
phone: form.phone,
avatar: form.avatar,
bio: form.bio
})
});

const updatedUser = res.user || res;
updateUser(updatedUser);
setForm({
name: updatedUser.name || '',
email: updatedUser.email || '',
phone: updatedUser.phone || '',
avatar: updatedUser.avatar || '',
bio: updatedUser.bio || ''
});
setProfileMessage('Profile updated successfully.');
} catch (e) {
setErr(e.message || 'Could not update your profile.');
} finally {
setSavingProfile(false);
}
}

async function changePassword(e) {
e.preventDefault();
setSavingPassword(true);
setErr('');
setPasswordMessage('');

if (newPassword !== confirmPassword) {
setSavingPassword(false);
return setErr('New password and confirmation do not match.');
}

if (newPassword.length < 8) {
setSavingPassword(false);
return setErr('New password must be at least 8 characters.');
}

try {
await api('/auth/password', {
method: 'PATCH',
body: JSON.stringify({ currentPassword, newPassword })
});

setCurrentPassword('');
setNewPassword('');
setConfirmPassword('');
setPasswordMessage('Password changed successfully.');
} catch (e) {
setErr(e.message || 'Could not change your password.');
} finally {
setSavingPassword(false);
}
}

const initials = String(user.name || 'U')
.trim()
.split(/\s+/)
.map(part => part[0])
.join('')
.slice(0, 2)
.toUpperCase();

return (
<section className="section">
<div className="section-head">
<div>
<p className="eyebrow">Account</p>
<h1>My profile</h1>
<p className="muted">Keep your Rentify contact details up to date.</p>
</div>

<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
<button
type="button"
className="secondary-wide"
onClick={() => go('/profile')}
style={{ width: 'auto' }}
>
View public profile
</button>
</div>
</div>

{err && <p className="error">{err}</p>}

<div className="info-card" style={{ marginBottom: 20 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
{form.avatar ? (
<img src={form.avatar} onError={imageFallback} alt={user.name || 'Profile'} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '3px solid #ccfbf1' }} />
) : (
<div style={{ width: 84, height: 84, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#ccfbf1', color: '#0f766e', fontSize: 26, fontWeight: 800, border: '3px solid #ccfbf1' }}>
{initials}
</div>
)}

<div>
<h2 style={{ margin: 0 }}>{user.name}</h2>
<p className="muted" style={{ margin: '5px 0 10px' }}>
{user.role === 'owner' ? 'Owner account' : 'Renter account'}{user.verified ? ' • Verified' : ''}
</p>
<label className="upload" style={{ display: 'inline-flex' }}>
<span>Change profile photo</span>
<input type="file" accept="image/*" onChange={handleAvatar} />
</label>
</div>
</div>

<form onSubmit={saveProfile} className="bigform">
<h2>Personal details</h2>

<label>
Full name
<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" required />
</label>

<label>
Email address
<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required />
</label>

<label>
Phone number
<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234..." />
</label>

<label>
  Bio
  <textarea
    value={form.bio}
    onChange={e => setForm({ ...form, bio: e.target.value })}
    placeholder="Tell people a little about yourself..."
    maxLength={200}
    rows={4}
  />
  <small className="muted">
    {form.bio.length}/200 characters
  </small>
</label>

{profileMessage && <p className="safe">{profileMessage}</p>}

<button className="wide" disabled={savingProfile}>
{savingProfile ? 'Saving profile...' : 'Save profile'}
</button>
</form>
</div>

<div className="info-card">
<h2>Change password</h2>
<p className="muted">Use a strong password you do not reuse on other sites.</p>

<form onSubmit={changePassword} className="bigform">
<label>
Current password
<input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Current password" required />
</label>

<label>
New password
<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required />
</label>

<label>
Confirm new password
<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" minLength={8} required />
</label>

{passwordMessage && <p className="safe">{passwordMessage}</p>}

<button className="secondary-wide" disabled={savingPassword}>
{savingPassword ? 'Changing password...' : 'Change password'}
</button>
</form>
</div>
</section>
);
}


function PublicHostProfile({ id, ownProfile = false }) {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setErr('');
    setData(null);

    if (!id) {
      setErr('We could not identify this host profile. Please sign in again.');
      setLoading(false);
      return;
    }

    api('/listings/host/' + encodeURIComponent(id))
      .then(res => setData(res))
      .catch(e => setErr(e.message || 'Could not load this host profile.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function shareProfile() {
    if (!data?.host) return;

    const url =
      `${location.origin}${location.pathname}` +
      `#/host/${data.host.id}`;

    const text =
      `Check out ${data.host.name || 'this Rentify host'} on Rentify.ng`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${data.host.name || 'Rentify host'} on Rentify.ng`,
          text,
          url
        });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert('Profile link copied. You can paste it on WhatsApp.');
      }
    } catch {}
  }

  if (loading) {
    return (
      <section className="section">
        <div className="empty">Loading host profile...</div>
      </section>
    );
  }

  if (err) {
    return (
      <section className="section">
        <button
          className="back-btn"
          onClick={() => go(ownProfile ? '/' : '/listings')}
        >
          ← {ownProfile ? 'Back home' : 'Back to listings'}
        </button>

        <div className="info-card" style={{ marginTop: 16 }}>
          <h1>Host profile unavailable</h1>
          <p className="error">{err}</p>
        </div>
      </section>
    );
  }

  if (!data?.host) {
    return (
      <section className="section">
        <div className="info-card">
          <h1>Host not found</h1>
          <p className="muted">
            This Rentify host profile could not be found.
          </p>
        </div>
      </section>
    );
  }

  const { host, listings = [] } = data;
  const isOwnProfile =
    user && String(user.id) === String(host.id);

  const initials = String(host.name || 'H')
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="section">
      <button
        className="back-btn"
        onClick={() => go(ownProfile ? '/' : '/listings')}
      >
        ← {ownProfile ? 'Back home' : 'Back to listings'}
      </button>

      <div
        className="info-card"
        style={{
          maxWidth: 900,
          margin: '16px auto 24px',
          padding: 24
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              minWidth: 0
            }}
          >
            {host.avatar ? (
              <img
                src={host.avatar}
                onError={imageFallback}
                alt={host.name || 'Host'}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #ccfbf1',
                  flexShrink: 0
                }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#ccfbf1',
                  color: '#0f766e',
                  fontSize: 28,
                  fontWeight: 800,
                  border: '3px solid #ccfbf1',
                  flexShrink: 0
                }}
              >
                {initials}
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap'
                }}
              >
                <h1 style={{ margin: 0 }}>
                  {host.name}
                </h1>

                {host.verified && (
                  <ShieldCheck
                    size={20}
                    color="#0f766e"
                    aria-label="Verified host"
                  />
                )}
              </div>

              <p
                className="muted"
                style={{ margin: '6px 0 0' }}
              >
                {host.role === 'owner'
                  ? 'Rentify host'
                  : 'Rentify member'}
                {host.verified ? ' • Verified' : ''}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <button
              className="share-btn"
              onClick={shareProfile}
            >
              <Share2 size={17} />
              Share profile
            </button>

            {(ownProfile || isOwnProfile) && (
              <button
                className="edit-btn"
                onClick={() => go('/profile/edit')}
              >
                <Edit3 size={17} />
                Edit profile
              </button>
            )}
          </div>
        </div>

        {host.bio ? (
          <div style={{ marginTop: 22 }}>
            <h3 style={{ marginBottom: 7 }}>About</h3>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {host.bio}
            </p>
          </div>
        ) : (
          <p
            className="muted"
            style={{ marginTop: 22, marginBottom: 0 }}
          >
            This host has not added a bio yet.
          </p>
        )}
      </div>

      <div className="section-head">
        <div>
          <p className="eyebrow">Rentify listings</p>
          <h2>{host.name}'s active listings</h2>
          <p className="muted">
            {listings.length
              ? `${listings.length} active listing${listings.length === 1 ? '' : 's'}`
              : 'No active listings right now.'}
          </p>
        </div>
      </div>

      {listings.length ? (
        <div className="grid">
          {listings.map(listing => (
            <ListingCard
              key={listing.id}
              l={listing}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          This host does not have any active listings at the moment.
        </div>
      )}
    </section>
  );
}


function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <section className="section">
        <div className="info-card">
          <h1>My profile</h1>
          <p className="muted">Please sign in to view your profile.</p>
          <button className="wide" onClick={() => go('/auth')}>
            Sign in
          </button>
        </div>
      </section>
    );
  }

  const userId = user.id || user._id;

  return <PublicHostProfile id={userId} ownProfile />;
}

function AboutPage() {
return (
<section className="section info-page">
  <button
    className="back-btn"
    onClick={() => go('/')}
  >
    ← Back home
  </button>

  <div className="info-card" style={{ maxWidth: 820, margin: '0 auto' }}>
    <p className="eyebrow">About Rentify.ng</p>

    <h1>Making renting simpler, safer, and more transparent.</h1>

    <p>
      Rentify.ng is a Nigerian rental marketplace connecting renters with
      owners, businesses, and service providers offering rentable assets.
      During private beta, we are focused on learning from real users,
      improving the booking and payment experience, and building a more
      structured way to discover and rent assets in Nigeria.
    </p>

    <h2>What Rentify is building</h2>

    <p>
      The Nigerian rental market can be fragmented and difficult to navigate.
      Rentify is designed to bring rental opportunities into one digital
      marketplace where people can discover listings, review details,
      communicate through the platform, and complete bookings through a
      structured payment flow.
    </p>

    <p>
      The long-term vision is to grow beyond property rentals into vehicles,
      equipment, warehouses, event items, private jets, and other rentable
      assets across Nigeria and eventually Africa.
    </p>

    <div style={{ marginTop: 24, padding: 20, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>Founder</p>
      <h2 style={{ marginTop: 0, marginBottom: 6 }}>Ahiaba David Ojochegbe</h2>
      <p style={{ fontWeight: 800, color: '#115e59', marginTop: 0 }}>
        Founder &amp; CEO, Rentify.ng · Lagos, Nigeria
      </p>
      <p>
        David is a Computer Science professional and technology entrepreneur
        building Rentify.ng. His software development background and interest
        in solving practical problems in the Nigerian and African market led
        to the creation of Rentify.
      </p>
      <p>
        His goal is to use technology to make rental discovery and transactions
        more structured, convenient, and transparent while creating a platform
        where renters and asset owners can connect.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        <a
          href="https://www.linkedin.com/in/david-ahiaba-a76887291/"
          target="_blank"
          rel="noreferrer"
          className="secondary-wide"
          style={{ textDecoration: 'none', display: 'inline-flex', width: 'auto' }}
        >
          LinkedIn
        </a>
        <a
          href="https://github.com/Davidoj1"
          target="_blank"
          rel="noreferrer"
          className="secondary-wide"
          style={{ textDecoration: 'none', display: 'inline-flex', width: 'auto' }}
        >
          GitHub
        </a>
      </div>
    </div>

    <p className="safe" style={{ marginTop: 22 }}>
      Rentify is currently in private beta in Nigeria. For support, contact
      support@rentify.ng.
    </p>
  </div>
</section>
);
}

function InfoPage({ type }) {
const isSafety =
type === 'safety';

return ( <section className="section info-page">
<button
className="back-btn"
onClick={() => go('/')}
>
← Back home </button>

  <div className="info-card">
    <FileText size={34} />

    <h1>
      {isSafety
        ? 'Rentify Safety Guide'
        : 'Rentify Terms for Beta Users'}
    </h1>

    {isSafety ? (
      <>
        <p>
          Rentify helps renters
          and owners connect
          safely across Nigeria.
          During beta, keep
          conversations and
          booking records inside
          Rentify.
        </p>

        <h3>
          Safety rules
        </h3>

        <ul>
          <li>
            Do not share
            passwords, OTPs,
            card details, or
            sensitive information
            in chat.
          </li>

          <li>
            Inspect physical
            items before handover
            where possible.
          </li>

          <li>
            Report suspicious
            listings or users
            immediately.
          </li>

          <li>
            Use reviews and
            verified badges as
            trust signals, not
            absolute guarantees.
          </li>
        </ul>

        <p className="safe">
          Beta note: Rentify is
          still improving
          verification, dispute
          handling, and payment
          protection.
        </p>
      </>
    ) : (
      <>
        <p>
          By using Rentify during
          beta, you understand
          that the platform
          connects renters and
          owners. Listings,
          availability, prices,
          and item condition are
          provided by owners.
        </p>

        <h3>
          Beta terms
        </h3>

        <ul>
          <li>
            Rentify may update
            features, pricing, and
            policies during beta.
          </li>

          <li>
            Owners are responsible
            for accurate listings
            and safe handover.
          </li>

          <li>
            Renters are
            responsible for
            checking listing
            details before booking.
          </li>

          <li>
            Rentify may remove
            suspicious listings or
            accounts.
          </li>

          <li>
            Platform fee is
            currently an
            introductory beta fee
            and may change later.
          </li>
        </ul>

        <p className="safe">
          For support,
          contact
          {' '}
          support@rentify.ng.
        </p>
      </>
    )}
  </div>
</section>

);
}

function App() {
const route =
useRoute();

let page = <Home />;

if (
route.startsWith(
'/listings'
)
) {
page = <Listings />;
}

if (
route.startsWith(
'/listing/'
)
) {
page = (
<ListingDetail
id={
route.split('/')[2]
}
/>
);
}

if (
route === '/auth'
) {
page = <Auth />;
}

if (
route === '/profile'
) {
page = <Profile />;
}

if (
route === '/profile/edit'
) {
page = <ProfileEditor />;
}

if (
route.startsWith('/host/')
) {
page = (
<PublicHostProfile
id={route.split('/')[2]}
/>
);
}

if (
route === '/dashboard'
) {
page = <Dashboard />;
}

if (
route === '/become-owner'
) {
page = <BecomeOwner />;
}

if (
route === '/become-renter'
) {
page = <BecomeRenter />;
}

if (
route === '/owner'
) {
page = <Owner />;
}

if (
route === '/create'
) {
page = <CreateListing />;
}

if (
route.startsWith(
'/edit/'
)
) {
page = (
<CreateListing
editId={
route.split('/')[2]
}
/>
);
}

if (
route.startsWith(
'/chat/'
)
) {
page = (
<Chat
id={
route.split('/')[2]
}
/>
);
}

if (
route.startsWith(
'/payment/verify'
)
) {
page = <PaymentVerify />;
}

if (
route === '/about'
) {
page = <AboutPage />;
}

if (
route === '/safety'
) {
page = ( <InfoPage
     type="safety"
   />
);
}

if (
route === '/terms'
) {
page = ( <InfoPage
     type="terms"
   />
);
}

return ( <>
<AuthProvider> <Layout>
{page} </Layout> </AuthProvider>
</>
);
}

createRoot(
document.getElementById('root')
).render( <App />
);