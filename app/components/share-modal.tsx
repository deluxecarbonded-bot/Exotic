import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCopy, IconCheck, IconX } from "~/components/icons";
import { useToastStore } from "~/stores/toast-store";

// ─── Custom brand SVG icons ────────────────────────────────────────────────────
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.333 4.821l-.004.059c-.016.345-.034.74.003 1.15.198.26.947.508 1.863.438.15-.012.293.047.425.171.132.124.193.268.193.404 0 .476-.474.98-1.388 1.377a2.11 2.11 0 0 0-.136.068c-.048.026-.127.072-.158.122-.016.028-.019.084.01.224.061.296.241.793.641 1.527.337.62.852 1.335 1.604 2.002.307.27.581.49.832.682.125.097.237.188.348.276a2.72 2.72 0 0 1 .24.225c.033.04.04.074.04.107 0 .134-.1.26-.283.352a2.033 2.033 0 0 1-.42.125 10.054 10.054 0 0 1-.694.122c-.18.028-.36.056-.523.09-.35.073-.484.194-.527.268-.09.159-.127.399-.118.7.008.278.073.548.138.818.065.27.13.54.13.818 0 .27-.065.5-.195.706-.13.206-.318.386-.573.546-.26.162-.562.29-.925.395-.365.105-.784.18-1.273.22-.244.02-.458.034-.637.052-.278.026-.434.084-.528.13-.095.047-.192.099-.32.148a3.33 3.33 0 0 1-1.192.225c-.343 0-.685-.067-1.035-.208a4.476 4.476 0 0 1-.463-.226c-.14-.077-.264-.14-.381-.168-.117-.028-.28-.04-.516-.038-.488.006-.929.123-1.358.234-.328.085-.66.168-.99.168-.33 0-.66-.083-.99-.168-.43-.111-.87-.228-1.357-.234-.237-.002-.4.01-.516.038-.118.028-.241.091-.381.168a4.476 4.476 0 0 1-.463.226c-.35.141-.692.208-1.035.208a3.33 3.33 0 0 1-1.192-.225c-.128-.05-.226-.101-.32-.148-.094-.046-.25-.104-.528-.13-.18-.018-.393-.032-.637-.051-.489-.04-.909-.115-1.273-.22a4.07 4.07 0 0 1-.925-.395 2.333 2.333 0 0 1-.573-.546 1.543 1.543 0 0 1-.196-.706c0-.278.065-.548.13-.818.065-.27.13-.54.138-.818.009-.301-.029-.541-.117-.7-.044-.074-.178-.195-.528-.268a20.8 20.8 0 0 0-.522-.09 10.054 10.054 0 0 1-.695-.122 2.033 2.033 0 0 1-.42-.125c-.183-.092-.283-.218-.283-.352 0-.033.007-.067.04-.107a2.72 2.72 0 0 1 .24-.225c.11-.088.223-.179.348-.276.25-.192.525-.412.832-.682.752-.667 1.267-1.382 1.604-2.002.4-.734.58-1.231.641-1.527.029-.14.026-.196.01-.224-.031-.05-.11-.096-.158-.122a2.11 2.11 0 0 0-.136-.068C1.474 12.98 1 12.476 1 12c0-.136.061-.28.193-.404.132-.124.275-.183.425-.171.916.07 1.665-.178 1.863-.438.037-.41.019-.805.003-1.15l-.004-.059c-.07-1.602-.196-3.628.333-4.821C5.393 1.069 8.75.793 9.74.793h.003c.172 0 .345.004.512.012C10.53.81 11.23.793 12.206.793"/>
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.908 1.528-1.147C21.69 2.28 24 3.434 24 5.457z"/>
    </svg>
  );
}

// ─── Platform config ───────────────────────────────────────────────────────────
const PLATFORMS = [
  {
    name: "WhatsApp",
    color: "#25D366",
    Icon: WhatsAppIcon,
    getUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
  },
  {
    name: "X",
    color: "#000000",
    darkColor: "#ffffff",
    Icon: XIcon,
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: "Telegram",
    color: "#26A5E4",
    Icon: TelegramIcon,
    getUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: "Facebook",
    color: "#1877F2",
    Icon: FacebookIcon,
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "Reddit",
    color: "#FF4500",
    Icon: RedditIcon,
    getUrl: (url: string, text: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    name: "LinkedIn",
    color: "#0A66C2",
    Icon: LinkedInIcon,
    getUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Snapchat",
    color: "#FFFC00",
    textColor: "#000",
    Icon: SnapchatIcon,
    getUrl: (url: string) =>
      `https://www.snapchat.com/share?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Email",
    color: "#EA4335",
    Icon: GmailIcon,
    getUrl: (url: string, text: string) =>
      `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
  },
];

// ─── Share Modal ───────────────────────────────────────────────────────────────
export function ShareModal({
  open,
  onClose,
  url,
  text = "Check this out on Exotic!",
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  text?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.classList.add('share-sheet-open');
    } else {
      document.body.classList.remove('share-sheet-open');
    }
    return () => document.body.classList.remove('share-sheet-open');
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    useToastStore.getState().addToast('Link copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl overflow-hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-1 pb-4">
              <h2 className="font-bold text-base">Share</h2>
              <button
                onClick={onClose}
                className="ghost-btn w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="px-4 pb-8 space-y-5">
              {/* Social icon grid */}
              <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                {PLATFORMS.map((p) => (
                  <a
                    key={p.name}
                    href={p.getUrl(url, text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 group"
                  >
                    <motion.div
                      whileTap={{ scale: 0.88 }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-opacity group-hover:opacity-90"
                      style={{ backgroundColor: p.color }}
                    >
                      <span style={{ color: p.textColor ?? "#fff" }}>
                        <p.Icon />
                      </span>
                    </motion.div>
                    <span className="text-[11px] text-muted-foreground font-medium leading-tight text-center">
                      {p.name}
                    </span>
                  </a>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Copy link row */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-muted rounded-xl px-4 py-3 min-w-0 gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground flex-shrink-0">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <span className="text-sm text-muted-foreground truncate flex-1">{url}</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold rounded-xl transition-colors flex-shrink-0 ${
                    copied
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                  {copied ? "Copied!" : "Copy"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
