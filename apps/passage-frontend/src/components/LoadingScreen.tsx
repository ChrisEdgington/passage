import { observer } from 'mobx-react-lite';
import { MessageCircle } from 'lucide-react';
import { MessagesController } from '@/controller';

export const LoadingScreen = observer(function LoadingScreen() {
  const controller = MessagesController.instance;

  return (
    <div className="h-screen w-screen bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center justify-center">
      {/* Animated logo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
          <MessageCircle className="w-10 h-10 text-white" />
        </div>
        {/* Spinning ring around logo */}
        <div className="absolute inset-0 -m-2">
          <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>

      <h1 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">Passage</h1>
      <p className="text-neutral-500 dark:text-neutral-400">
        {controller.connectionStatus === 'connecting' && 'Connecting to server...'}
        {controller.connectionStatus === 'reconnecting' && 'Reconnecting...'}
      </p>

      {controller.serverUrl && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">{controller.serverUrl}</p>
      )}
    </div>
  );
});
