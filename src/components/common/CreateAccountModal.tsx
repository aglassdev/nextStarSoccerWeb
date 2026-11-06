import { Link } from 'react-router-dom';

// Accounts are created in the app; the website is for managing them. This
// popup says so, and points coaches to the coach application.
const CreateAccountModal = ({ onClose }: { onClose: () => void }) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
    onClick={onClose}
  >
    <div
      className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl font-lt-wave"
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src="/assets/images/nss-icon.png"
        alt="Next Star Soccer"
        className="w-16 h-16 mx-auto mb-5 rounded-2xl"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <h2 className="text-white text-xl font-bold mb-2 leading-snug">Create your account in the app</h2>
      <p className="text-gray-400 text-sm mb-2">
        Download the Next Star app to create a free account for yourself or your family. Once you have one, you can
        also sign in here to manage it on the web.
      </p>
      <p className="text-gray-600 text-xs mb-7">Available on iOS and Android</p>
      <div className="flex justify-center items-center gap-4">
        <a href="https://apps.apple.com/us/app/next-star-soccer/id6754170423" target="_blank" rel="noopener noreferrer">
          <img src="/assets/images/badge-app-store.svg" alt="Download on the App Store" className="h-9 w-auto" />
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US" target="_blank" rel="noopener noreferrer">
          <img src="/assets/images/badge-google-play.png" alt="Get it on Google Play" className="h-9 w-auto" />
        </a>
      </div>
      <div className="mt-7 pt-5 border-t border-white/[0.08] space-y-2 text-sm">
        <p className="text-gray-400">
          Already have an account?{' '}
          <Link to="/signin" onClick={onClose} className="text-white underline underline-offset-2">Sign in</Link>
        </p>
        <p className="text-gray-400">
          Want to coach with us?{' '}
          <Link to="/coachapply" onClick={onClose} className="text-white underline underline-offset-2">Apply to coach</Link>
        </p>
      </div>
      <button className="mt-5 text-gray-500 text-xs hover:text-gray-300 transition-colors" onClick={onClose}>
        Maybe later
      </button>
    </div>
  </div>
);

export default CreateAccountModal;
