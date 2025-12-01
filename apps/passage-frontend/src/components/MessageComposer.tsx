import { observer } from 'mobx-react-lite';
import { useState, useEffect, FormEvent, ClipboardEvent, useRef } from 'react';
import { MessagesController } from '@/controller';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, X, Image as ImageIcon } from 'lucide-react';

// Command system: /r<char> for quick emoji reactions
// Note: Native iMessage tapbacks require Private API injection (like BlueBubbles)
// which is not supported. These commands send the emoji as a regular message.
const REACTION_EMOJI_MAP: Record<string, string> = {
  h: '❤️',      // heart
  l: '😂',      // laugh
  t: '👍',      // thumbs up
  d: '👎',      // thumbs down
  e: '‼️',      // emphasize
  q: '❓',      // question
  s: '😊',      // smile
  f: '🔥',      // fire
  c: '👏',      // clap
};

// Slack-style emoji shortcodes :emoji_name:
const EMOJI_SHORTCODES: Record<string, string> = {
  // Smileys & emotions
  smile: '😊', grin: '😁', joy: '😂', rofl: '🤣', laughing: '😆',
  wink: '😉', blush: '😊', heart_eyes: '😍', kissing_heart: '😘',
  thinking: '🤔', raised_eyebrow: '🤨', neutral_face: '😐', expressionless: '😑',
  unamused: '😒', rolling_eyes: '🙄', grimacing: '😬', relieved: '😌',
  pensive: '😔', sleepy: '😪', drooling_face: '🤤', sleeping: '😴',
  mask: '😷', nerd: '🤓', sunglasses: '😎', confused: '😕',
  worried: '😟', frowning: '☹️', sob: '😭', cry: '😢',
  scream: '😱', fearful: '😨', cold_sweat: '😰', disappointed: '😞',
  angry: '😠', rage: '😡', triumph: '😤', skull: '💀',
  poop: '💩', clown: '🤡', ghost: '👻', alien: '👽',
  robot: '🤖', smiley_cat: '😺', heart_eyes_cat: '😻', smirk: '😏',
  yum: '😋', stuck_out_tongue: '😛', zany: '🤪', shush: '🤫',

  // Gestures & body
  thumbsup: '👍', thumbs_up: '👍', '+1': '👍',
  thumbsdown: '👎', thumbs_down: '👎', '-1': '👎',
  ok_hand: '👌', ok: '👌',
  pinched_fingers: '🤌', pinch: '🤌',
  victory: '✌️', peace: '✌️',
  crossed_fingers: '🤞', fingers_crossed: '🤞',
  love_you: '🤟', rock_on: '🤘', metal: '🤘',
  call_me: '🤙', wave: '👋', hi: '👋', bye: '👋',
  clap: '👏', raised_hands: '🙌', pray: '🙏', thanks: '🙏',
  handshake: '🤝', muscle: '💪', strong: '💪',
  point_up: '☝️', point_down: '👇', point_left: '👈', point_right: '👉',
  middle_finger: '🖕', fu: '🖕',
  fist: '✊', punch: '👊',
  eyes: '👀', eye: '👁️', brain: '🧠',

  // Hearts & love
  heart: '❤️', red_heart: '❤️', love: '❤️',
  orange_heart: '🧡', yellow_heart: '💛', green_heart: '💚',
  blue_heart: '💙', purple_heart: '💜', black_heart: '🖤',
  white_heart: '🤍', brown_heart: '🤎', pink_heart: '💗',
  sparkling_heart: '💖', heartbeat: '💓', heartpulse: '💗',
  two_hearts: '💕', revolving_hearts: '💞', heart_decoration: '💟',
  broken_heart: '💔', heart_exclamation: '❣️', cupid: '💘',
  gift_heart: '💝', kiss: '💋',

  // Celebration & objects
  fire: '🔥', lit: '🔥', hot: '🔥',
  star: '⭐', star2: '🌟', sparkles: '✨', dizzy: '💫',
  boom: '💥', collision: '💥', zap: '⚡', lightning: '⚡',
  party: '🎉', tada: '🎉', confetti: '🎊', balloon: '🎈',
  gift: '🎁', present: '🎁', trophy: '🏆', medal: '🏅',
  crown: '👑', gem: '💎', diamond: '💎', money: '💰',
  dollar: '💵', euro: '💶', pound: '💷', yen: '💴',
  bell: '🔔', mega: '📣', loudspeaker: '📢',

  // Common objects
  phone: '📱', computer: '💻', keyboard: '⌨️', mouse: '🖱️',
  tv: '📺', camera: '📷', video_camera: '📹', movie: '🎬',
  headphones: '🎧', mic: '🎤', musical_note: '🎵', notes: '🎶',
  book: '📖', books: '📚', pencil: '✏️', pen: '🖊️',
  memo: '📝', clipboard: '📋', calendar: '📅', file_folder: '📁',
  email: '📧', envelope: '✉️', package: '📦', mailbox: '📬',
  lock: '🔒', unlock: '🔓', key: '🔑', hammer: '🔨',
  wrench: '🔧', gear: '⚙️', link: '🔗', paperclip: '📎',
  bulb: '💡', idea: '💡', flashlight: '🔦', candle: '🕯️',
  bomb: '💣', gun: '🔫', pill: '💊', syringe: '💉',

  // Nature & weather
  sun: '☀️', sunny: '☀️', cloud: '☁️', rain: '🌧️',
  snow: '❄️', snowflake: '❄️', thunder: '⛈️', rainbow: '🌈',
  moon: '🌙', crescent_moon: '🌙', full_moon: '🌕',
  earth: '🌍', globe: '🌐', volcano: '🌋', mountain: '⛰️',
  tree: '🌳', palm_tree: '🌴', cactus: '🌵', flower: '🌸',
  rose: '🌹', tulip: '🌷', sunflower: '🌻', leaf: '🍃',

  // Food & drink
  pizza: '🍕', burger: '🍔', fries: '🍟', hotdog: '🌭',
  taco: '🌮', burrito: '🌯', sushi: '🍣', ramen: '🍜',
  spaghetti: '🍝', bread: '🍞', cheese: '🧀', egg: '🥚',
  bacon: '🥓', steak: '🥩', poultry: '🍗', shrimp: '🦐',
  apple: '🍎', banana: '🍌', orange: '🍊', lemon: '🍋',
  watermelon: '🍉', grapes: '🍇', strawberry: '🍓', peach: '🍑',
  avocado: '🥑', eggplant: '🍆', carrot: '🥕', corn: '🌽',
  cake: '🍰', cookie: '🍪', donut: '🍩', chocolate: '🍫',
  candy: '🍬', lollipop: '🍭', icecream: '🍦', ice_cream: '🍨',
  coffee: '☕', tea: '🍵', beer: '🍺', beers: '🍻',
  wine: '🍷', cocktail: '🍸', tropical_drink: '🍹', champagne: '🍾',

  // Animals
  dog: '🐕', cat: '🐈', mouse_face: '🐭', rabbit: '🐰',
  fox: '🦊', bear: '🐻', panda: '🐼', koala: '🐨',
  tiger: '🐯', lion: '🦁', cow: '🐄', pig: '🐷',
  frog: '🐸', monkey: '🐵', see_no_evil: '🙈', hear_no_evil: '🙉',
  speak_no_evil: '🙊', chicken: '🐔', penguin: '🐧', bird: '🐦',
  eagle: '🦅', duck: '🦆', owl: '🦉', bat: '🦇',
  wolf: '🐺', horse: '🐴', unicorn: '🦄', bee: '🐝',
  bug: '🐛', butterfly: '🦋', snail: '🐌', octopus: '🐙',
  fish: '🐟', dolphin: '🐬', whale: '🐋', shark: '🦈',
  turtle: '🐢', snake: '🐍', dragon: '🐉', dinosaur: '🦕',

  // Symbols & arrows
  check: '✅', white_check_mark: '✅', x: '❌', cross: '❌',
  warning: '⚠️', exclamation: '❗', question: '❓', bangbang: '‼️',
  interrobang: '⁉️', hundred: '💯', 100: '💯',
  plus: '➕', minus: '➖', multiply: '✖️', divide: '➗',
  arrow_up: '⬆️', arrow_down: '⬇️', arrow_left: '⬅️', arrow_right: '➡️',
  arrow_upper_right: '↗️', arrow_lower_right: '↘️',
  arrow_lower_left: '↙️', arrow_upper_left: '↖️',
  arrows_counterclockwise: '🔄', refresh: '🔄',
  back: '🔙', end: '🔚', on: '🔛', soon: '🔜', top: '🔝',
  new: '🆕', free: '🆓', up: '🆙', cool: '🆒', ok_button: '🆗',
  sos: '🆘', no_entry: '⛔', prohibited: '🚫', stop: '🛑',

  // Misc
  zzz: '💤', sleep: '💤', speech_balloon: '💬', thought_balloon: '💭',
  wave_dash: '〰️', infinity: '♾️', recycle: '♻️',
  fleur_de_lis: '⚜️', trident: '🔱', anchor: '⚓',
  peace_symbol: '☮️', yin_yang: '☯️', cross_symbol: '✝️',
  star_of_david: '✡️', wheel_of_dharma: '☸️', om: '🕉️',
  atom: '⚛️', radioactive: '☢️', biohazard: '☣️',

  // Flags (common ones)
  us: '🇺🇸', usa: '🇺🇸', uk: '🇬🇧', gb: '🇬🇧',
  canada: '🇨🇦', ca: '🇨🇦', australia: '🇦🇺', au: '🇦🇺',
  france: '🇫🇷', fr: '🇫🇷', germany: '🇩🇪', de: '🇩🇪',
  italy: '🇮🇹', it: '🇮🇹', spain: '🇪🇸', es: '🇪🇸',
  japan: '🇯🇵', jp: '🇯🇵', china: '🇨🇳', cn: '🇨🇳',
  india: '🇮🇳', brazil: '🇧🇷', mexico: '🇲🇽',
  rainbow_flag: '🏳️‍🌈', pride: '🏳️‍🌈',
  pirate_flag: '🏴‍☠️', white_flag: '🏳️', checkered_flag: '🏁',
};

// Replace :shortcode: patterns with emojis
function replaceEmojiShortcodes(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, code) => {
    const emoji = EMOJI_SHORTCODES[code.toLowerCase()];
    return emoji || match; // Return original if not found
  });
}

interface CommandResult {
  type: 'reaction' | 'unknown';
  emoji?: string;
  error?: string;
}

function parseCommand(input: string): CommandResult | null {
  const trimmed = input.trim();

  // Check for reaction command: /r<char>
  if (trimmed.startsWith('/r') && trimmed.length === 3) {
    const reactionChar = trimmed[2].toLowerCase();
    const emoji = REACTION_EMOJI_MAP[reactionChar];
    if (emoji) {
      return { type: 'reaction', emoji };
    }
    return {
      type: 'unknown',
      error: `Unknown: ${reactionChar}. Try: h(eart), l(augh), t(humbs up), d(own), e(!), q(?), s(mile), f(ire), c(lap)`
    };
  }

  return null;
}

// Convert and resize image to JPEG
const MAX_DIMENSION = 1500;

async function convertToJpeg(file: File, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions, keeping aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not convert to JPEG'));
            return;
          }
          const jpegFile = new File([blob], 'image.jpg', { type: 'image/jpeg' });
          resolve(jpegFile);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export const MessageComposer = observer(() => {
  const controller = MessagesController.instance;
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pastedImage, setPastedImage] = useState<{ file: File; preview: string } | null>(null);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only auto-focus after sending completes (user was already typing)
  useEffect(() => {
    if (!isSending && inputRef.current === document.activeElement) {
      // Keep focus if we were already focused (just finished sending)
    }
  }, [isSending]);

  const handlePaste = async (e: ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            // Convert to JPEG at 80% quality for smaller file size
            const jpegFile = await convertToJpeg(file, 0.8);

            // Sanity check: if the file is still huge, something went wrong
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (jpegFile.size > maxSize) {
              showFeedback(`Image too large (${(jpegFile.size / 1024 / 1024).toFixed(1)}MB) - resize failed`);
              return;
            }

            const preview = URL.createObjectURL(jpegFile);
            setPastedImage({ file: jpegFile, preview });
          } catch (error) {
            console.error('Failed to process image:', error);
            showFeedback('Failed to process image - try a different format');
          }
        }
        break;
      }
    }
  };

  const clearImage = () => {
    if (pastedImage) {
      URL.revokeObjectURL(pastedImage.preview);
      setPastedImage(null);
    }
  };

  const showFeedback = (message: string) => {
    setCommandFeedback(message);
    setTimeout(() => setCommandFeedback(null), 3000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const hasContent = text.trim() || pastedImage;
    if (!hasContent || !controller.selectedConversation) return;

    // Check for commands
    const command = parseCommand(text);
    if (command) {
      if (command.type === 'reaction' && command.emoji) {
        // Send the emoji as a regular message (native tapbacks not supported)
        const recipient = controller.selectedConversation.participants[0]?.handleIdentifier;
        if (recipient) {
          setIsSending(true);
          try {
            await controller.sendMessage(recipient, command.emoji, undefined);
            setText('');
          } catch (error) {
            console.error('Failed to send emoji:', error);
            showFeedback('Failed to send');
          } finally {
            setIsSending(false);
          }
        }
        return;
      } else if (command.error) {
        showFeedback(command.error);
        return;
      }
    }

    const recipient = controller.selectedConversation.participants[0]?.handleIdentifier;
    if (!recipient) {
      console.error('No recipient found');
      return;
    }

    setIsSending(true);

    try {
      let attachmentPath: string | undefined;

      // Upload image first if there is one
      if (pastedImage) {
        const formData = new FormData();
        formData.append('image', pastedImage.file);

        const uploadRes = await fetch(`${controller.apiBaseUrl}/api/v1/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadRes.json();
        attachmentPath = uploadData.filePath;
      }

      // Replace emoji shortcodes before sending
      const messageText = replaceEmojiShortcodes(text.trim());
      await controller.sendMessage(recipient, messageText, attachmentPath);
      setText('');
      clearImage();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!controller.selectedConversation) {
    return null;
  }

  const hasContent = text.trim() || pastedImage;

  return (
    <div className="p-3 bg-background border-t border-border">
      {/* Image preview */}
      {pastedImage && (
        <div className="mb-2 relative inline-block">
          <img
            src={pastedImage.preview}
            alt="Pasted image"
            className="max-h-32 rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            placeholder={pastedImage ? "Add a caption..." : "iMessage"}
            disabled={isSending}
            className="h-9 text-[14px] rounded-md pl-3 pr-10 bg-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
          />
          {pastedImage && !text.trim() && (
            <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
          <Button
            type="submit"
            size="icon"
            disabled={!hasContent || isSending}
            className={cn(
              'absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md transition-all',
              hasContent ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            )}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </form>

      {/* Instructions line */}
      <p className="text-[14px] text-foreground/70 mt-1.5 px-1 truncate">
        Tab toggle • j/k nav • u unread • /rh ❤️ /rl 😂 • :emoji:
      </p>

      {commandFeedback && (
        <p className="text-xs text-muted-foreground mt-1 px-2">{commandFeedback}</p>
      )}

      {controller.error && (
        <p className="text-xs text-destructive mt-1 px-2">{controller.error}</p>
      )}
    </div>
  );
});
