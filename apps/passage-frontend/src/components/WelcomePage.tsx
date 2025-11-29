import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { MessageCircle, ArrowRight, ChevronDown, ChevronUp, Terminal, Shield, Wifi } from 'lucide-react';
import { MessagesController } from '@/controller';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Fake conversation data for the blurred background
const FAKE_CONVERSATIONS = [
  { name: 'Mom', preview: 'See you at dinner!', time: '2:30 PM' },
  { name: 'John Smith', preview: 'The meeting is at 3pm', time: '1:45 PM' },
  { name: 'Work Group', preview: 'Alice: Great work everyone!', time: '12:00 PM' },
  { name: 'Best Friend', preview: 'Haha that was hilarious', time: '11:30 AM' },
  { name: 'Partner', preview: 'Love you!', time: 'Yesterday' },
];

const FAKE_MESSAGES = [
  { text: 'Hey, how are you?', isFromMe: false },
  { text: 'I am doing great, thanks for asking!', isFromMe: true },
  { text: 'Want to grab lunch later?', isFromMe: false },
  { text: 'Sure! Where should we meet?', isFromMe: true },
];

function SetupStep({
  number,
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  number: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
          {number}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium flex-1">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export const WelcomePage = observer(function WelcomePage() {
  const controller = MessagesController.instance;
  const [serverUrl, setServerUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!serverUrl.trim()) return;
    setIsConnecting(true);
    setError(null);

    const success = await controller.configureServer(serverUrl.trim());
    if (!success) {
      setError(controller.connectionError || 'Could not connect to server. Make sure the backend is running.');
    }
    setIsConnecting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-neutral-100 dark:bg-neutral-900">
      {/* Blurred fake UI background */}
      <div className="absolute inset-0 blur-sm opacity-30 pointer-events-none select-none" aria-hidden="true">
        <div className="h-full flex">
          {/* Fake sidebar */}
          <div className="w-80 bg-neutral-200 dark:bg-neutral-800 border-r border-neutral-300 dark:border-neutral-700 h-full p-4">
            <h1 className="text-2xl font-bold mb-4 text-neutral-800 dark:text-neutral-200">Messages</h1>
            <div className="space-y-2">
              {FAKE_CONVERSATIONS.map((conv, i) => (
                <div key={i} className="p-3 rounded-xl bg-neutral-300/50 dark:bg-neutral-700/50">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{conv.name}</span>
                    <span className="text-xs text-neutral-500">{conv.time}</span>
                  </div>
                  <p className="text-sm text-neutral-500 truncate">{conv.preview}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fake message thread */}
          <div className="flex-1 p-4 flex flex-col bg-neutral-50 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 dark:border-neutral-700 pb-2 mb-4">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">Mom</h2>
            </div>
            <div className="flex-1 space-y-2">
              {FAKE_MESSAGES.map((msg, i) => (
                <div key={i} className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={cn(
                      'px-3 py-2 rounded-2xl max-w-xs',
                      msg.isFromMe ? 'bg-blue-500 text-white' : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Welcome card overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-20 p-4">
        <div className="bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Logo/icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-neutral-900 dark:text-neutral-100">
            Welcome to Passage
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-center mb-2">
            Access your iMessages and SMS from any browser
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mb-6">
            Your messages are never stored or cached. Passage reads directly from the Messages app in real-time — no archiving, no data collection, just a secure bridge to your conversations.
          </p>

          {/* Setup instructions */}
          <div className="space-y-2 mb-6">
            <SetupStep number={1} title="Install & Run the Backend" icon={Terminal}>
              <p className="mb-3">Run these commands on your Mac:</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                <div className="text-neutral-500"># Clone the repository</div>
                <div>git clone https://github.com/chrisedgington/passage</div>
                <div>cd passage</div>
                <div className="mt-2 text-neutral-500"># Install and build</div>
                <div>pnpm install && pnpm build</div>
                <div className="mt-2 text-neutral-500"># Start the backend</div>
                <div>node apps/passage-backend/dist/server.js</div>
              </div>
              <p className="mt-3 text-xs">
                Requires Node.js 20+ and Xcode Command Line Tools. Run{' '}
                <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">xcode-select --install</code> if needed.
              </p>
            </SetupStep>

            <SetupStep number={2} title="Grant Full Disk Access" icon={Shield}>
              <p className="mb-2">Your terminal app needs permission to read Messages:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>
                  Open <strong>System Settings</strong>
                </li>
                <li>
                  Go to <strong>Privacy & Security</strong> → <strong>Full Disk Access</strong>
                </li>
                <li>Click the + button and add your terminal app</li>
                <li>Restart your terminal and the backend server</li>
              </ol>
            </SetupStep>

            <SetupStep number={3} title="Find Your Mac's IP Address" icon={Wifi}>
              <p className="mb-2">In Terminal, run:</p>
              <div className="bg-neutral-900 text-neutral-100 rounded-lg p-3 font-mono text-xs mb-3">
                ipconfig getifaddr en0
              </div>
              <p className="text-xs">
                Or open <strong>System Settings → Network</strong> and click your active connection to see the IP.
              </p>
            </SetupStep>
          </div>

          {/* Connection form */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Server Address</label>
            <div className="flex gap-2">
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="192.168.1.x:3000"
                disabled={isConnecting}
                className="flex-1"
              />
              <Button onClick={handleConnect} disabled={!serverUrl.trim() || isConnecting}>
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Connect
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Enter your Mac's IP address and port (default: 3000)
            </p>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-2">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
              Passage runs on your local network with no authentication. Only use on trusted networks.
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
              Questions?{' '}
              <a
                href="https://x.com/EdgingtonC"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                @EdgingtonC on X
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
