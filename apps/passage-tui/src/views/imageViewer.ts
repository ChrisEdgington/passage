import terminalImage from 'terminal-image';
import type { Attachment } from '@passage/shared-types';
import { terminal } from '../core/terminal.js';
import { colors, box } from '../core/themes.js';
import { clearPane, writePaneLine, type LayoutDimensions } from './layout.js';
import { truncate, formatSize } from '../core/render.js';

export interface ImageViewerProps {
  attachment: Attachment;
  renderedImage: string | null;
  loading: boolean;
  error: string | null;
  layout: LayoutDimensions;
}

export function renderImageViewer(props: ImageViewerProps): void {
  const { attachment, renderedImage, loading, error, layout } = props;
  const { width, height } = layout;

  // Calculate overlay dimensions (centered, with padding)
  const overlayPadding = 2;
  const overlayWidth = width - overlayPadding * 2;
  const overlayHeight = height - overlayPadding * 2;
  const overlayLeft = overlayPadding;
  const overlayTop = overlayPadding;

  // Clear overlay area
  clearPane(overlayLeft, overlayTop, overlayWidth, overlayHeight);

  // Draw border
  drawBorder(overlayLeft, overlayTop, overlayWidth, overlayHeight);

  // Title bar
  const title = ` ${truncate(attachment.filename, overlayWidth - 20)} (${formatSize(attachment.totalBytes)}) `;
  const titlePadded = centerText(title, overlayWidth - 2);
  terminal.writeAt(overlayLeft + 1, overlayTop, colors.accent()(titlePadded));

  // Content area
  const contentLeft = overlayLeft + 2;
  const contentTop = overlayTop + 2;
  const contentWidth = overlayWidth - 4;
  const contentHeight = overlayHeight - 4;

  if (loading) {
    const loadingText = 'Loading image...';
    const centerY = contentTop + Math.floor(contentHeight / 2);
    const centerX = contentLeft + Math.floor((contentWidth - loadingText.length) / 2);
    terminal.writeAt(centerX, centerY, colors.fgMuted()(loadingText));
  } else if (error) {
    const errorText = `Error: ${error}`;
    const centerY = contentTop + Math.floor(contentHeight / 2);
    const centerX = contentLeft + Math.floor((contentWidth - errorText.length) / 2);
    terminal.writeAt(centerX, centerY, colors.error()(errorText));
  } else if (renderedImage) {
    // Render the pre-rendered image
    const lines = renderedImage.split('\n');
    for (let i = 0; i < lines.length && i < contentHeight; i++) {
      terminal.writeAt(contentLeft, contentTop + i, lines[i]);
    }
  }

  // Help text at bottom
  const helpText = ' Press ESC or q to close ';
  const helpPadded = centerText(helpText, overlayWidth - 2);
  terminal.writeAt(overlayLeft + 1, overlayTop + overlayHeight - 1, colors.fgMuted()(helpPadded));
}

function drawBorder(left: number, top: number, width: number, height: number): void {
  // Top border
  terminal.writeAt(left, top, colors.border()(box.topLeft + box.horizontal.repeat(width - 2) + box.topRight));

  // Side borders
  for (let y = top + 1; y < top + height - 1; y++) {
    terminal.writeAt(left, y, colors.border()(box.vertical));
    terminal.writeAt(left + width - 1, y, colors.border()(box.vertical));
  }

  // Bottom border
  terminal.writeAt(left, top + height - 1, colors.border()(box.bottomLeft + box.horizontal.repeat(width - 2) + box.bottomRight));
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text + ' '.repeat(width - padding - text.length);
}

// Render an image buffer to a string suitable for terminal display
export async function renderImageToString(
  buffer: Buffer,
  maxWidth: number,
  maxHeight: number
): Promise<string> {
  // Reserve some space for borders and padding
  const width = Math.max(20, maxWidth - 6);
  const height = Math.max(10, maxHeight - 6);

  const rendered = await terminalImage.buffer(buffer, {
    width,
    height,
    preserveAspectRatio: true,
  });

  return rendered;
}
