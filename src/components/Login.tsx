import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Lock, Mail, Github, Chrome, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Login({ unverifiedEmail }: { unverifiedEmail?: string | null }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationEmailSentTo, setVerificationEmailSentTo] = useState<string | null>(null);

  const displayEmail = unverifiedEmail || verificationEmailSentTo;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Starting Google Login...");
      const provider = new GoogleAuthProvider();
      // Ensure we are using popup for this environment
      const result = await signInWithPopup(auth, provider);
      console.log("Google Login success:", result.user.email);
    } catch (err: any) {
      console.error("Google Login error:", err);
      let msg = err.message;
      if (err.code === 'auth/popup-blocked') {
        msg = "The login popup was blocked by your browser. Please allow popups for this site.";
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = "Google Login is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.";
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = "This domain is not authorized for Firebase Auth. Add it in Authentication > Settings > Authorized domains.";
      } else if (err.message.includes('cross-origin-opener-policy')) {
        msg = "Browser security settings blocked the login. Try opening the app in a new tab or use a different browser.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCred.user);
        // We stay "signed in" in Firebase Auth but App.tsx will block access
        // and show the verification required screen.
        setVerificationEmailSentTo(email);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          // If not verified, App.tsx will naturally catch this and show the verification screen
          // via the unverifiedEmail prop. We don't want to auto-resend on every login attempt.
          setVerificationEmailSentTo(email);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (displayEmail) {
    return (
      <div className="min-h-screen bg-[#1a184d] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden border border-white/20"
        >
          <div className="bg-[#222063] p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -ml-16 -mb-16" />
            
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">VERIFICATION REQUIRED</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Check your inbox</p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12 space-y-8 text-center">
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-600 leading-relaxed">
                We have sent you a verification email to <span className="text-primary">{displayEmail}</span>. 
                Please verify it and log in.
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Access is restricted to verified operators only
              </p>
            </div>

            <button
              onClick={async () => {
                await signOut(auth);
                setVerificationEmailSentTo(null);
                setError(null);
                setLoading(false);
              }}
              className="w-full py-5 bg-[#f2980b] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-500/20 hover:bg-slate-800 transition-all transform active:scale-95 flex items-center justify-center gap-3"
            >
              <LogIn className="w-4 h-4" />
              Back to Login
            </button>

            <button 
              onClick={async () => {
                if (auth.currentUser) {
                  await sendEmailVerification(auth.currentUser);
                  alert("Verification email resent!");
                }
              }}
              className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
            >
              Didn't receive code? Resend Email
            </button>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            Secure Terminal v4.2.0 • Primelink DMS HQ
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a184d] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden border border-white/20"
      >
        <div className="bg-[#222063] p-12 text-center relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -ml-16 -mb-16" />
          
          <div className="relative z-10 space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Primelink DMS</h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Security Portal</p>
          </div>
        </div>

        <div className="p-8 md:p-12 space-y-8">
          <div className="space-y-4">
            <button
              id="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-4 hover:bg-slate-100 hover:border-slate-200 transition-all group disabled:opacity-50"
            >
              <div className="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
                <Chrome className="w-5 h-5 text-rose-500" />
              </div>
              <span className="font-black text-slate-700 text-[10px] md:text-xs uppercase tracking-widest">
                {loading ? 'Please wait...' : 'Continue with Google'}
              </span>
            </button>
            <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-tight">
              Note: If popup fails, try opening the app in a <a href={window.location.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">new tab</a>.
            </p>
          </div>

          <div className="relative flex items-center gap-4 text-slate-300">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Or use keys</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">HQ Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@swat-dms.com"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all text-sm font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all text-sm font-bold"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-[10px] font-bold leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-[#f2980b] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-500/20 hover:bg-slate-800 transition-all transform active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {loading ? 'Processing...' : (isSignUp ? 'Create Operator Account' : 'Authenticate Access')}
            </button>
          </form>

          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need operator access? Request Account'}
          </button>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
          Secure Terminal v4.2.0 • Authorized Personnel Only
        </div>
      </motion.div>
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
