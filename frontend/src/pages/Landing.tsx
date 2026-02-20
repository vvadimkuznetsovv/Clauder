import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
         style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-lg text-center">
        <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--accent)' }}>
          Clauder
        </h1>
        <p className="text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
          Claude Code in your browser
        </p>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          A self-hosted web interface for Claude Code. Chat with AI, edit files, run commands —
          all from your phone or desktop browser. Your own AI-powered development server.
        </p>

        <div className="flex gap-4 justify-center mb-12">
          <Link
            to="/login"
            className="px-6 py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Sign In
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 text-left">
          {[
            { title: 'Chat', desc: 'Interact with Claude Code via chat' },
            { title: 'Files', desc: 'Browse and edit files with Monaco Editor' },
            { title: 'Terminal', desc: 'Full terminal access via xterm.js' },
            { title: 'Secure', desc: '2FA authentication, JWT tokens' },
          ].map((item) => (
            <div key={item.title} className="p-4 rounded-xl"
                 style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--accent)' }}>
                {item.title}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Want your own Clauder instance?{' '}
          <a href="#" style={{ color: 'var(--accent)' }} className="hover:underline">
            Get in touch
          </a>
        </p>
      </div>
    </div>
  );
}
