import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execAsync = promisify(exec);

export interface SendMessageOptions {
  recipient: string; // Phone number or email
  text: string;
  attachmentPath?: string; // Optional file path to send as attachment
}

export class AppleScriptMessenger {
  /**
   * Send a message using AppleScript
   * This requires Messages.app to be running
   */
  async sendMessage(options: SendMessageOptions): Promise<{ success: boolean; error?: string }> {
    const { recipient, text, attachmentPath } = options;

    // Escape special characters for AppleScript strings (which use double quotes)
    // Backslashes must be escaped first, then double quotes
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedRecipient = recipient.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    // If we have an attachment, use a different script that sends the file
    if (attachmentPath) {
      return this.sendMessageWithAttachment(escapedRecipient, escapedText, attachmentPath);
    }

    const script = `
      tell application "Messages"
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant "${escapedRecipient}" of targetService
        send "${escapedText}" to targetBuddy
      end tell
    `;

    try {
      await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`);
      return { success: true };
    } catch (error: any) {
      console.error('AppleScript error:', error);

      // Try SMS fallback if iMessage fails
      try {
        const smsScript = `
          tell application "Messages"
            set targetService to 1st account whose service type = SMS
            set targetBuddy to participant "${escapedRecipient}" of targetService
            send "${escapedText}" to targetBuddy
          end tell
        `;

        await execAsync(`osascript -e '${smsScript.replace(/'/g, "'\"'\"'")}'`);
        return { success: true };
      } catch (smsError: any) {
        console.error('SMS fallback error:', smsError);
        return {
          success: false,
          error: `Failed to send message: ${error.message}. SMS fallback also failed: ${smsError.message}`,
        };
      }
    }
  }

  /**
   * Send a message with an attachment using AppleScript
   */
  private async sendMessageWithAttachment(
    escapedRecipient: string,
    escapedText: string,
    attachmentPath: string
  ): Promise<{ success: boolean; error?: string }> {
    // AppleScript for sending file attachments via Messages
    // We need to use a temp script file to handle the POSIX file path properly
    const script = `
tell application "Messages"
  set targetService to 1st account whose service type = iMessage
  set targetBuddy to participant "${escapedRecipient}" of targetService
  set theAttachment to POSIX file "${attachmentPath}"
  send theAttachment to targetBuddy
  ${escapedText ? `send "${escapedText}" to targetBuddy` : ''}
end tell
`;

    const tmpFile = join(tmpdir(), `send-attachment-${Date.now()}.scpt`);

    try {
      await writeFile(tmpFile, script, 'utf8');
      await execAsync(`osascript "${tmpFile}"`);
      await unlink(tmpFile).catch(() => {});
      return { success: true };
    } catch (error: any) {
      console.error('AppleScript attachment error:', error);
      await unlink(tmpFile).catch(() => {});

      // Try SMS fallback
      try {
        const smsScript = `
tell application "Messages"
  set targetService to 1st account whose service type = SMS
  set targetBuddy to participant "${escapedRecipient}" of targetService
  set theAttachment to POSIX file "${attachmentPath}"
  send theAttachment to targetBuddy
  ${escapedText ? `send "${escapedText}" to targetBuddy` : ''}
end tell
`;
        const smsTmpFile = join(tmpdir(), `send-attachment-sms-${Date.now()}.scpt`);
        await writeFile(smsTmpFile, smsScript, 'utf8');
        await execAsync(`osascript "${smsTmpFile}"`);
        await unlink(smsTmpFile).catch(() => {});
        return { success: true };
      } catch (smsError: any) {
        console.error('SMS fallback attachment error:', smsError);
        return {
          success: false,
          error: `Failed to send attachment: ${error.message}. SMS fallback also failed: ${smsError.message}`,
        };
      }
    }
  }

  /**
   * Check if Messages.app is running
   */
  async isMessagesRunning(): Promise<boolean> {
    const script = `
      tell application "System Events"
        return (name of processes) contains "Messages"
      end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      return stdout.trim() === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Launch Messages.app if not running
   */
  async launchMessages(): Promise<void> {
    const script = `
      tell application "Messages"
        activate
      end tell
    `;

    try {
      await execAsync(`osascript -e '${script}'`);
    } catch (error: any) {
      throw new Error(`Failed to launch Messages.app: ${error.message}`);
    }
  }

  /**
   * Send a reaction (tapback) to a message using UI automation
   * This uses System Events to control the Messages UI
   *
   * Reaction indices:
   * 1 = ❤️ Love
   * 2 = 👍 Like
   * 3 = 👎 Dislike
   * 4 = 😂 Laugh
   * 5 = ‼️ Emphasize
   * 6 = ❓ Question
   */
  async sendReaction(
    chatName: string,
    messageText: string,
    reactionIndex: number
  ): Promise<{ success: boolean; error?: string }> {
    // Escape special characters for AppleScript
    const escapedChatName = chatName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapedMessageText = messageText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const script = `
tell application "System Events"
    tell process "Messages"
        set groupMatch to -1

        (* Iterate over each chat row *)
        repeat with chatRow in ((table 1 of scroll area 1 of splitter group 1 of window 1)'s entire contents as list)
            if chatRow's class is row then

                (* Pull out the chat's name *)
                set fullName to (chatRow's UI element 1)'s description
                set nameSplit to my splitText(fullName, ". ")
                set chatDisplayName to item 1 of nameSplit

                (* Find matching chat *)
                if chatDisplayName is equal to "${escapedChatName}" then
                    set groupMatch to chatRow
                    exit repeat
                end if
            end if
        end repeat

        (* If no match, exit *)
        if groupMatch is equal to -1 then
            error "Chat not found: ${escapedChatName}"
        end if

        (* Activate Messages window *)
        tell application "Messages"
            reopen
            activate
        end tell
        delay 0.5

        (* Select the chat *)
        select groupMatch
        delay 0.3

        tell window 1 to tell splitter group 1
            set previousRow to null
            (* Get the text messages as a list and reverse it to get newest first *)
            set chatItems to reverse of (entire contents of scroll area 2 as list)

            (* Iterate over all the messages *)
            repeat with n from 1 to count of chatItems
                set chatRow to (item n of chatItems)

                (* Check the types of the current row and previous row *)
                if chatRow's class is static text and previousRow's class is group then
                    set textValue to chatRow's value

                    (* Compare the text with what we are looking for *)
                    if textValue is equal to "${escapedMessageText}" then
                        select chatRow
                        tell previousRow to perform action "AXShowMenu"
                        delay 0.5
                        key code 125
                        keystroke return
                        delay 1.0

                        (* Re-fetch the rows so we can get the tapback row *)
                        set newRows to reverse of (entire contents of scroll area 2 as list)
                        set tapBack to item (n + 1) of newRows
                        if tapBack's class is not radio group then
                            set tapBack to item (n - 1) of newRows
                        end if
                        tell radio button ${reactionIndex} of tapBack to perform action "AXPress"
                        delay 0.3
                        keystroke return

                        return "success"
                    end if
                end if

                set previousRow to chatRow
            end repeat
        end tell

        error "Message not found: ${escapedMessageText}"
    end tell
end tell

on splitText(theText, theDelimiter)
    set AppleScript's text item delimiters to theDelimiter
    set theTextItems to every text item of theText
    set AppleScript's text item delimiters to ""
    return theTextItems
end splitText
`;

    const tmpFile = join(tmpdir(), `send-reaction-${Date.now()}.scpt`);

    try {
      await writeFile(tmpFile, script, 'utf8');
      await execAsync(`osascript "${tmpFile}"`, { timeout: 15000 });
      await unlink(tmpFile).catch(() => {});
      return { success: true };
    } catch (error: any) {
      console.error('AppleScript reaction error:', error);
      await unlink(tmpFile).catch(() => {});
      return {
        success: false,
        error: `Failed to send reaction: ${error.message}`,
      };
    }
  }
}
