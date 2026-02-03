import { useEffect, useState } from 'react';

declare const IS_MACOS: boolean;

export function TitleBar() {
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        // Check if we are on macOS using the global constant
        if (typeof IS_MACOS !== 'undefined' && IS_MACOS) {
            setIsMac(true);
        }
    }, []);

    return (
        <div data-tauri-drag-region className={`h-8 bg-background flex justify-between items-center select-none fixed top-0 left-0 right-0 z-50 border-b ${isMac ? 'pl-20' : 'pl-4'}`}>
            <div className="flex items-center pointer-events-none">
                <span className="text-xs font-medium text-muted-foreground">SafeKey</span>
            </div>

            <div data-tauri-drag-region className="flex-1 h-full" />
        </div>
    );
}
