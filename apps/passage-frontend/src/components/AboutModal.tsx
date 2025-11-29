import { useState } from 'react';
import { HelpCircle, MessageCircle, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AboutModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-md hover:bg-accent transition-colors"
        aria-label="About Passage"
      >
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setIsOpen(false)} />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-md hover:bg-accent transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Logo */}
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-center mb-2">Passage</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Access your iMessages and SMS from any browser on your local network
              </p>

              {/* Description */}
              <div className="text-sm text-muted-foreground space-y-3 mb-6">
                <p>
                  Passage is an open-source macOS app that proxies your Messages.app, letting you
                  read and send iMessages and SMS from any device on your network - Linux desktops,
                  smart TVs, or any browser.
                </p>
                <p>
                  Built with React, MobX, Express, and WebSockets. The backend reads directly from
                  the Messages.app SQLite database and uses AppleScript to send messages.
                </p>
              </div>

              {/* Links */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Links
                </h3>

                <LinkItem href="https://github.com/chrisedgington/passage" label="GitHub Repository" />
                <LinkItem href="https://edgecraftstudio.com" label="Edgecraft Studio" />
                <LinkItem href="https://cedgington.dev" label="cedgington.dev" />
                <LinkItem href="https://x.com/chrisedgington" label="@chrisedgington on X" />
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Made with care by Chris Edgington
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center justify-between p-2 rounded-lg',
        'hover:bg-accent transition-colors',
        'text-sm text-foreground'
      )}
    >
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
}
