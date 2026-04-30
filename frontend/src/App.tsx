import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './App.css';

type Auction = {
  id: number;
  name: string;
  description: string;
  startingPrice: number;
  durationSeconds: number;
  status: 'ACTIVE' | 'ENDED';
  endsAt: string;
  remainingSeconds: number;
  currentHighestBid: null | {
    amount: number;
    userId: number;
    createdAt: string;
  };
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL ?? API_URL;

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function toFriendlyError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function getStatusLabel(remainingSeconds: number) {
  return remainingSeconds > 0 ? 'ACTIVE' : 'ENDED';
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);
  return parts.join(' ');
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.message === 'string') message = body.message;
      if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch {
      // ignore parse errors and keep fallback message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function useSocket() {
  const socket = useMemo<Socket>(() => io(WS_URL), []);
  useEffect(
    () => () => {
      socket.disconnect();
    },
    [socket],
  );
  return socket;
}

function Dashboard({ socket }: { socket: Socket }) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    startingPrice: '10',
    durationSeconds: '120',
  });

  const loadAuctions = async () => {
    try {
      setError('');
      const data = await apiRequest<Auction[]>('/auctions');
      setAuctions(data);
    } catch (err) {
      setError(toFriendlyError(err, 'Unable to load auctions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuctions();
    const interval = setInterval(() => void loadAuctions(), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onBidUpdated = (payload: { itemId: number; amount: number; userId: number; createdAt: string }) => {
      setAuctions((current) =>
        current.map((auction) =>
          auction.id === payload.itemId
            ? {
                ...auction,
                currentHighestBid: {
                  amount: payload.amount,
                  userId: payload.userId,
                  createdAt: payload.createdAt,
                },
              }
            : auction,
        ),
      );
    };

    socket.on('bid.updated', onBidUpdated);
    return () => {
      socket.off('bid.updated', onBidUpdated);
    };
  }, [socket]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    try {
      await apiRequest('/auctions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          startingPrice: Number(form.startingPrice),
          durationSeconds: Number(form.durationSeconds),
        }),
      });
      setForm({ name: '', description: '', startingPrice: '10', durationSeconds: '120' });
      await loadAuctions();
    } catch (err) {
      setFormError(toFriendlyError(err, 'Failed to create auction item.'));
    }
  };

  return (
    <div className="pageShell">
      <div className="container">
        <header className="pageHeader card">
          <p className="kicker">Live Bidding Studio</p>
          <h1>PayNest Real-Time Auction Dashboard</h1>
          <p className="lead">
            Launch premium auctions, track live offers, and manage bids in a sleek command center.
          </p>
        </header>

        <section className="card">
          <h2>Create Auction Item</h2>
          <p className="sectionText">Start a new listing and open it for live bidding in seconds.</p>
        <form onSubmit={onSubmit} className="grid">
          <input
            required
            placeholder="Item name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <input
            required
            placeholder="Description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
          <input
            required
            min={1}
            step={0.01}
            type="number"
            placeholder="Starting price ($)"
            value={form.startingPrice}
            onChange={(event) =>
              setForm((current) => ({ ...current, startingPrice: event.target.value }))
            }
          />
          <input
            required
            min={1}
            step={1}
            type="number"
            placeholder="Duration (seconds)"
            value={form.durationSeconds}
            onChange={(event) =>
              setForm((current) => ({ ...current, durationSeconds: event.target.value }))
            }
          />
          <button className="buttonPrimary" type="submit">
            Create Auction
          </button>
        </form>
        {formError && <p className="error">{formError}</p>}
        </section>

        <section className="card">
          <h2>Available Auctions</h2>
          <p className="sectionText">Discover active lots and jump into any auction room.</p>
          {loading && <p className="muted">Loading auctions...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && auctions.length === 0 && <p className="muted">No auctions available yet.</p>}
          <div className="auctionList">
            {auctions.map((auction) => (
              <article key={auction.id} className="auctionCard">
                <div className="auctionCardHead">
                  <h3>{auction.name}</h3>
                  <span className={`statusPill ${getStatusLabel(auction.remainingSeconds).toLowerCase()}`}>
                    {getStatusLabel(auction.remainingSeconds)}
                  </span>
                </div>
                <p>{auction.description}</p>
                <div className="auctionMeta">
                  <p>Starting price: {formatMoney(auction.startingPrice)}</p>
                  <p>
                    Current highest bid:{' '}
                    {auction.currentHighestBid
                      ? formatMoney(auction.currentHighestBid.amount)
                      : 'No bids yet'}
                  </p>
                  <p>Time left: {formatDuration(auction.remainingSeconds)}</p>
                </div>
                <Link className="detailsLink" to={`/auctions/${auction.id}`}>
                  Open details
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AuctionDetail({ socket }: { socket: Socket }) {
  const params = useParams();
  const navigate = useNavigate();
  const itemId = Number(params.id);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [amount, setAmount] = useState('');
  const [userId, setUserId] = useState('1');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const loadAuction = async () => {
    try {
      const data = await apiRequest<Auction>(`/auctions/${itemId}`);
      setAuction(data);
    } catch (err) {
      setError(toFriendlyError(err, 'Could not load auction details.'));
    }
  };

  useEffect(() => {
    if (!Number.isFinite(itemId) || itemId < 1) return;
    void loadAuction();
  }, [itemId]);

  useEffect(() => {
    if (!Number.isFinite(itemId) || itemId < 1) return;
    socket.emit('auction.subscribe', { itemId });

    const onBidUpdated = (payload: { itemId: number; amount: number; userId: number; createdAt: string }) => {
      if (payload.itemId !== itemId) return;
      setAuction((current) =>
        current
          ? {
              ...current,
              currentHighestBid: {
                amount: payload.amount,
                userId: payload.userId,
                createdAt: payload.createdAt,
              },
            }
          : current,
      );
    };

    socket.on('bid.updated', onBidUpdated);
    return () => {
      socket.off('bid.updated', onBidUpdated);
    };
  }, [itemId, socket]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAuction((current) => {
        if (!current) return current;
        const next = Math.max(current.remainingSeconds - 1, 0);
        return { ...current, remainingSeconds: next, status: next > 0 ? 'ACTIVE' : 'ENDED' };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const placeBid = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');

    try {
      await apiRequest('/bids', {
        method: 'POST',
        body: JSON.stringify({
          itemId,
          userId: Number(userId),
          amount: Number(amount),
        }),
      });
      setInfo('Bid accepted.');
      setAmount('');
      await loadAuction();
    } catch (err) {
      setError(toFriendlyError(err, 'Bid could not be placed.'));
    }
  };

  if (!Number.isFinite(itemId) || itemId < 1) {
    return (
      <div className="container">
        <p className="error">Invalid auction id.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <button className="buttonSecondary" onClick={() => navigate('/')}>
        Back to dashboard
      </button>
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
      {!auction ? (
        <p className="muted">Loading auction...</p>
      ) : (
        <section className="card">
          <div className="auctionCardHead">
            <h2>{auction.name}</h2>
            <span className={`statusPill ${getStatusLabel(auction.remainingSeconds).toLowerCase()}`}>
              {getStatusLabel(auction.remainingSeconds)}
            </span>
          </div>
          <p>{auction.description}</p>
          <div className="detailGrid">
            <div className="detailRow">
              <p className="detailLabel">Starting price</p>
              <p className="detailValue">{formatMoney(auction.startingPrice)}</p>
            </div>
            <div className="detailRow">
              <p className="detailLabel">Current highest bid</p>
              <p className="detailValue">
                {auction.currentHighestBid ? formatMoney(auction.currentHighestBid.amount) : 'No bids yet'}
              </p>
            </div>
            <div className="detailRow">
              <p className="detailLabel">Time remaining</p>
              <p className="detailValue">{formatDuration(auction.remainingSeconds)}</p>
            </div>
            <div className="detailRow">
              <p className="detailLabel">Auction status</p>
              <p className="detailValue">{getStatusLabel(auction.remainingSeconds)}</p>
            </div>
          </div>

          <form onSubmit={placeBid} className="bidForm">
            <div className="formRow">
              <label htmlFor="user-id-input">User ID</label>
              <input
                id="user-id-input"
                min={1}
                step={1}
                required
                type="number"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="User ID (1-100)"
              />
            </div>
            <div className="formRow">
              <label htmlFor="bid-amount-input">Bid Amount</label>
              <input
                id="bid-amount-input"
                min={0.01}
                step={0.01}
                required
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Bid amount ($)"
              />
            </div>
            <div className="formRow formActionRow">
              <button className="buttonPrimary" type="submit" disabled={auction.remainingSeconds === 0}>
                Place Bid
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function App() {
  const socket = useSocket();

  return (
    <Routes>
      <Route path="/" element={<Dashboard socket={socket} />} />
      <Route path="/auctions/:id" element={<AuctionDetail socket={socket} />} />
    </Routes>
  );
}

export default App;
