import { IconMegaphone } from '~/components/icons';

// Desktop: empty state (sidebar shows the channel list)
// Mobile: left sidebar is hidden so this renders — but layout handles showing sidebar instead

export default function ChannelsIndex() {
  return (
    <div className="hidden md:flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <IconMegaphone size={32} className="text-muted-foreground/50" />
      </div>
      <div>
        <p className="font-semibold text-base">Select a channel</p>
        <p className="text-sm text-muted-foreground mt-1">Choose from your channels on the left to start reading</p>
      </div>
    </div>
  );
}
