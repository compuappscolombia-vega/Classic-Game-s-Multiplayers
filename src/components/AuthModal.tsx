import { useState } from 'react';
import { X, ShieldCheck, Globe } from 'lucide-react';
import { signInWithApple, signInWithGoogle } from '../lib/firebase.ts';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}

export function AuthModal({ open, onClose, onSignedIn }: AuthModalProps) {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleGoogle = async () => {
    setErrorMsg(null);
    setLoadingProvider('google');
    try {
      await signInWithGoogle();
      onSignedIn();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setErrorMsg(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleApple = async () => {
    setErrorMsg(null);
    setLoadingProvider('apple');
    try {
      await signInWithApple();
      onSignedIn();
      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          'Apple Sign-In is configured in the client SDK, and requires enabling the Apple provider in Firebase Console (Authentication → Sign-in method → Apple) with your Apple Services ID.'
        );
      } else {
        const msg = err instanceof Error ? err.message : 'Apple sign-in failed';
        setErrorMsg(msg);
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141b18] border border-white/12 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#f4f1ea]">Sync Your Player Account</h2>
            <p className="text-sm text-stone-400 mt-1">
              Play ranked multiplayer across mobile and desktop with automatic ELO & match history sync.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 cursor-pointer"
            aria-label="Close sign in dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={loadingProvider !== null}
            onClick={handleGoogle}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white hover:bg-stone-100 text-stone-900 font-semibold text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{loadingProvider === 'google' ? 'Connecting Google...' : 'Continue with Google'}</span>
          </button>

          <button
            type="button"
            disabled={loadingProvider !== null}
            onClick={handleApple}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#000000] hover:bg-stone-900 border border-white/20 text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43Zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45Z" />
            </svg>
            <span>{loadingProvider === 'apple' ? 'Connecting Apple ID...' : 'Continue with Apple ID'}</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200 leading-relaxed">
            {errorMsg}
          </div>
        )}

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Verified ELO & Cloud Save
          </span>
          <span className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-amber-400" />
            Cross-Device Ready
          </span>
        </div>
      </div>
    </div>
  );
}
