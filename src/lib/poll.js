// Client-side helpers for the venue-demand poll (Step 8)

export async function fetchResults() {
  const res = await fetch('/api/results');
  if (!res.ok) throw new Error('Failed to fetch poll results');
  return res.json();
}

export async function submitVote(choice, postcode = '') {
  const res = await fetch('/api/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice, postcode }),
  });
  if (!res.ok) throw new Error('Failed to submit vote');
  return res.json();
}
