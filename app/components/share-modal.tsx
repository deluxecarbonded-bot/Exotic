import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { IconCopy, IconCheck } from "~/components/icons";

const SOCIAL_PLATFORMS = [
  {
    name: "WhatsApp",
    icon: "https://cdn.simpleicons.org/whatsapp/25D366",
    getUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
  },
  {
    name: "X",
    icon: "https://cdn.simpleicons.org/x/000000",
    darkIcon: "https://cdn.simpleicons.org/x/ffffff",
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: "Telegram",
    icon: "https://cdn.simpleicons.org/telegram/26A5E4",
    getUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: "Facebook",
    icon: "https://cdn.simpleicons.org/facebook/1877F2",
    getUrl: (url: string, _text: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "Reddit",
    icon: "https://cdn.simpleicons.org/reddit/FF4500",
    getUrl: (url: string, text: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    name: "LinkedIn",
    icon: "https://cdn.simpleicons.org/linkedin/0A66C2",
    getUrl: (url: string, _text: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Snapchat",
    icon: "https://cdn.simpleicons.org/snapchat/FFFC00",
    getUrl: (url: string, _text: string) =>
      `https://www.snapchat.com/share?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Email",
    icon: "https://cdn.simpleicons.org/gmail/EA4335",
    getUrl: (url: string, text: string) =>
      `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
  },
];

export function ShareModal({
  open,
  onClose,
  url,
  text = "Ask me anything anonymously on Exotic!",
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  text?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share your link</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Social platform buttons */}
          <div className="grid grid-cols-4 gap-3">
            {SOCIAL_PLATFORMS.map((platform) => (
              <a
                key={platform.name}
                href={platform.getUrl(url, text)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-muted transition-colors"
              >
                <img
                  src={platform.darkIcon || platform.icon}
                  alt={platform.name}
                  className="w-8 h-8 dark:hidden"
                  loading="lazy"
                />
                <img
                  src={platform.darkIcon || platform.icon}
                  alt={platform.name}
                  className="w-8 h-8 hidden dark:block"
                  loading="lazy"
                />
                <span className="text-[10px] text-muted-foreground font-medium">
                  {platform.name}
                </span>
              </a>
            ))}
          </div>

          {/* Link field + copy button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-muted rounded-lg min-w-0">
              <span className="text-sm text-muted-foreground truncate">
                {url}
              </span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex-shrink-0 ${
                copied
                  ? "bg-green-500/10 text-green-500"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied ? "Copied" : "Copy"}
            </motion.button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
