import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const socketMock = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMock),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          name: 'Gaming Laptop',
          description: 'RTX enabled machine',
          startingPrice: 100,
          durationSeconds: 120,
          status: 'ACTIVE',
          endsAt: new Date(Date.now() + 60_000).toISOString(),
          remainingSeconds: 60,
          currentHighestBid: { amount: 120, userId: 2, createdAt: new Date().toISOString() },
        },
      ],
    } as Response);
  });

  it('renders auction cards with key fields', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText('Gaming Laptop');
    expect(screen.getByText('RTX enabled machine')).toBeInTheDocument();
    expect(screen.getByText(/Starting price:/)).toBeInTheDocument();
    expect(screen.getByText(/Current highest bid:/)).toBeInTheDocument();
    expect(screen.getByText(/Time left:/)).toBeInTheDocument();
  });

  it('shows error message for invalid create action', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bid amount is invalid.' }),
      } as Response);

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText('Create Auction Item');
    await userEvent.type(screen.getByPlaceholderText('Item name'), 'Phone');
    await userEvent.type(screen.getByPlaceholderText('Description'), 'New model');
    await userEvent.clear(screen.getByPlaceholderText('Starting price ($)'));
    await userEvent.type(screen.getByPlaceholderText('Starting price ($)'), '40');
    await userEvent.clear(screen.getByPlaceholderText('Duration (seconds)'));
    await userEvent.type(screen.getByPlaceholderText('Duration (seconds)'), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Create Auction' }));

    await waitFor(() => {
      expect(screen.getByText('Bid amount is invalid.')).toBeInTheDocument();
    });
  });
});
