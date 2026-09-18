import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AdminQuestionForm } from '@/components/admin-question-form';

let mockFetch: ReturnType<typeof vi.fn>;

function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText('slug'), {
    target: { value: 'two-sum' }
  });
  fireEvent.change(screen.getByPlaceholderText('title'), {
    target: { value: 'Two Sum' }
  });
  fireEvent.change(screen.getByPlaceholderText('prompt'), {
    target: { value: 'Find indices' }
  });
}

beforeEach(() => {
  mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ question: { title: 'Two Sum' } })
  });
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<AdminQuestionForm />', () => {
  it('all required fields render with required attribute', () => {
    render(<AdminQuestionForm />);
    expect(screen.getByPlaceholderText('slug').hasAttribute('required')).toBe(true);
    expect(screen.getByPlaceholderText('title').hasAttribute('required')).toBe(true);
    expect(screen.getByPlaceholderText('prompt').hasAttribute('required')).toBe(true);
    expect(
      screen.getByPlaceholderText('starter code').hasAttribute('required')
    ).toBe(true);
  });

  it('successful submit posts payload and clears the form', async () => {
    render(<AdminQuestionForm />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Create question/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/questions');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      slug: 'two-sum',
      title: 'Two Sum',
      prompt: 'Find indices',
      type: 'FUNCTION_JS',
      difficulty: 'EASY',
      accessTier: 'FREE',
      isPublished: true
    });
    expect(body.starterCode).toHaveProperty('javascript');

    await waitFor(() => {
      expect(screen.queryByText(/Created question Two Sum/)).toBeTruthy();
    });
    expect((screen.getByPlaceholderText('slug') as HTMLInputElement).value).toBe('');
  });

  it('surfaces server error message on failed submit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Slug already exists' })
    });
    render(<AdminQuestionForm />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Create question/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Slug already exists/)).toBeTruthy();
    });
  });

  it('falls back to generic error when response body has none', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<AdminQuestionForm />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Create question/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Failed to create question/)).toBeTruthy();
    });
  });

  it('Submit button disabled while pending; shows "Creating..."', async () => {
    let resolve!: (v: unknown) => void;
    mockFetch.mockImplementation(
      () =>
        new Promise(res => {
          resolve = () =>
            res({ ok: true, json: async () => ({ question: { title: 'X' } }) });
        })
    );
    render(<AdminQuestionForm />);
    fillRequired();
    const btn = screen.getByRole('button', {
      name: /Create question/i
    }) as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(btn.disabled).toBe(true));
    expect(btn.textContent).toMatch(/Creating/);
    resolve(null);
    await waitFor(() => expect(btn.disabled).toBe(false));
  });

  it('switching type to FUNCTION_PYTHON swaps starter code to python default', () => {
    render(<AdminQuestionForm />);
    const starter = screen.getByPlaceholderText(
      'starter code'
    ) as HTMLTextAreaElement;
    expect(starter.value).toMatch(/function solve/);

    const typeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'FUNCTION_PYTHON' } });
    expect(starter.value).toMatch(/def solve/);
  });

  it('serializes comma-separated tags into array, trimmed and non-empty', async () => {
    render(<AdminQuestionForm />);
    fillRequired();
    fireEvent.change(screen.getByLabelText('Topic tags'), {
      target: { value: ' arrays , two-pointer ,  , hash ' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Create question/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tags).toEqual(['arrays', 'two-pointer', 'hash']);
  });
});
