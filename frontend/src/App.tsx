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
    <div className="container">
      <h1>PayNest Real-Time Auction Dashboard</h1>

      <section className="card">
        <h2>Create Auction Item</h2>
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
            placeholder="Starting price"
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
          <button type="submit">Create Auction</button>
        </form>
        {formError && <p className="error">{formError}</p>}
      </section>

      <section className="card">
        <h2>Available Auctions</h2>
        {loading && <p>Loading auctions...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && auctions.length === 0 && <p>No auctions available yet.</p>}
        <div className="auctionList">
          {auctions.map((auction) => (
            <div key={auction.id} className="auctionCard">
              <h3>{auction.name}</h3>
              <p>{auction.description}</p>
              <p>Starting price: {formatMoney(auction.startingPrice)}</p>
              <p>
                Current highest bid:{' '}
                {auction.currentHighestBid
                  ? formatMoney(auction.currentHighestBid.amount)
                  : 'No bids yet'}
              </p>
              <p>Time left: {auction.remainingSeconds}s</p>
              <p>Status: {auction.remainingSeconds > 0 ? 'ACTIVE' : 'ENDED'}</p>
              <Link to={`/auctions/${auction.id}`}>Open details</Link>
            </div>
          ))}
        </div>
      </section>
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
      <button onClick={() => navigate('/')}>Back to dashboard</button>
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
      {!auction ? (
        <p>Loading auction...</p>
      ) : (
        <section className="card">
          <h2>{auction.name}</h2>
          <p>{auction.description}</p>
          <p>Starting price: {formatMoney(auction.startingPrice)}</p>
          <p>
            Current highest bid:{' '}
            {auction.currentHighestBid ? formatMoney(auction.currentHighestBid.amount) : 'No bids yet'}
          </p>
          <p>Remaining time: {auction.remainingSeconds}s</p>
          <p>Status: {auction.remainingSeconds > 0 ? 'ACTIVE' : 'ENDED'}</p>

          <form onSubmit={placeBid} className="grid">
            <input
              min={1}
              step={1}
              required
              type="number"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="User ID (1-100)"
            />
            <input
              min={0.01}
              step={0.01}
              required
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Bid amount"
            />
            <button type="submit" disabled={auction.remainingSeconds === 0}>
              Place Bid
            </button>
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
