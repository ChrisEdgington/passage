import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Settings, Server, LogOut } from 'lucide-react';
import { MessagesController } from '@/controller';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SettingsDropdown = observer(function SettingsDropdown() {
  const controller = MessagesController.instance;
  const [isOpen, setIsOpen] = useState(false);
  const [serverInput, setServerInput] = useState(controller.serverUrl || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!serverInput.trim()) return;
    setIsConnecting(true);
    setError(null);

    const success = await controller.configureServer(serverInput.trim());
    if (success) {
      setIsOpen(false);
    } else {
      setError(controller.connectionError || 'Could not connect to server');
    }
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    controller.disconnectServer();
    setServerInput('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-accent transition-colors"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-card border border-border rounded-md shadow-lg p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Server className="h-3 w-3" />
              Server Connection
            </div>

            <Input
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="192.168.1.x:3000"
              className="mb-2 text-sm"
              disabled={isConnecting}
            />

            {error && <p className="text-xs text-destructive mb-2">{error}</p>}

            <div className="flex gap-2">
              <Button
                onClick={handleConnect}
                disabled={!serverInput.trim() || isConnecting}
                size="sm"
                className="flex-1"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>

              {controller.serverUrl && (
                <Button onClick={handleDisconnect} variant="outline" size="sm" title="Disconnect">
                  <LogOut className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Connection status */}
            {controller.serverUrl && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      controller.connectionStatus === 'connected' && 'bg-green-500',
                      controller.connectionStatus === 'connecting' && 'bg-yellow-500 animate-pulse',
                      controller.connectionStatus === 'reconnecting' && 'bg-yellow-500 animate-pulse',
                      controller.connectionStatus === 'error' && 'bg-destructive'
                    )}
                  />
                  {controller.connectionStatus === 'connected' && `Connected to ${controller.serverUrl}`}
                  {controller.connectionStatus === 'connecting' && 'Connecting...'}
                  {controller.connectionStatus === 'reconnecting' && 'Reconnecting...'}
                  {controller.connectionStatus === 'error' && 'Connection error'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});
