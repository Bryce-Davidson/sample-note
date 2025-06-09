<div align="center">

# Sample Note Beta (v0.1.26)

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/bryce-davidson/sample-note?label=version)](https://github.com/bryce-davidson/sample-note/releases)

**[Features](#features)** • **[Installation](#installation)** • **[Documentation](#documentation)** • **[Support](#support)**

<a href="https://buymeacoffee.com/datanoteable" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

_The Obsidian community has been an incredible source of inspiration and support throughout this journey. Your enthusiasm, feedback, and shared passion for knowledge management have made developing this plugin an absolute joy. Every donation, no matter how small, helps me dedicate more time to improving Sample Note and creating features that make our collective learning experience even better. Thank you for being part of this amazing community. Together, we're building something truly special. 💜_

![cover](docs/images/cover.gif)

</div>

---

## About

I've always loved Obsidian and have been a supporter from nearly the beginning, but I found it tedious to synchronize my notes with other forms of learning programs such as Anki, GoodNotes, etc.

To remedy this, I've created a plugin to make Obsidian my single source of truth by replicating my favourite features from all different kinds of learning tools within Obsidian.

I hope you enjoy.

-- Bryce

## Features

### GoodNotes Style Handwriting

Keep handwritten notes directly in Obsidian and linked to your notes using the GoodNotes style drawing editor.

![draw](docs/images/draw.gif)

### Integrated Text Occlusion & Flashcards

Hide content within your notes to ensure you are reviewing the material as you read (can toggle this mode to see notes normally).

Create and review flashcards without having to synchronize to Anki. Your flashcards automatically update as your notes change.

![flashcard](docs/images/flashcard.gif)

### Integrated Image Occlusion

Create, preview, and review image occlusions directly within Obsidian bot within your notes as you read them and as flashcards.

![occlusion](docs/images/occlusions.gif)

### Flashcard Graph

Track your learning progress with the interactive flashcard graph to visualize your study patterns. The graph animates and highlights flashcards which need improvement while showing the relationships between different cards. This visualization helps you optimize your study sessions by focusing on the cards that need the most attention.

![graph](docs/images/graph.gif)

### Copilot Chat Assistant

Select the context for the model and ask the assistant to create notes, make flashcards, or explain concepts; or anything else.

![chat](docs/images/chat.gif)

## Installation

### Installing from GitHub

1. **Download the plugin files**

    - Go to the [Releases page](https://github.com/bryce-davidson/sample-note/releases) on GitHub
    - Download the latest release files (`main.js`, `manifest.json`, and `styles.css`)

2. **Locate your Obsidian vault's plugins folder**

    - Open Obsidian and go to Settings → Community plugins
    - Click on the folder icon next to "Installed plugins" to open your vault's plugins folder
    - Alternatively, navigate to: `YourVault/.obsidian/plugins/`

3. **Install the plugin**

    - Create a new folder called `sample-note` in the plugins folder
    - Copy the downloaded files (`main.js`, `manifest.json`, and `styles.css`) into this folder

4. **Enable the plugin**
    - Go back to Obsidian Settings → Community plugins
    - Reload Obsidian or click the reload button
    - Find "Sample Note Beta" in the list and toggle it on

### Installing using BRAT

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) is a plugin that makes it easy to install and test beta plugins directly from GitHub.

1. **Install BRAT**

    - Open Obsidian Settings → Community plugins
    - Click "Browse" and search for "BRAT"
    - Install and enable the BRAT plugin

2. **Add Sample Note Beta to BRAT**

    - Open the Command Palette (Cmd/Ctrl + P)
    - Run the command: `BRAT: Add a beta plugin for testing`
    - Enter the GitHub repository URL: `https://github.com/bryce-davidson/sample-note`
    - Click "Add Plugin"

3. **Enable the plugin**

    - After BRAT confirms the installation, go to Settings → Community plugins
    - Find "Sample Note Beta" in the list and toggle it on

4. **Updating the plugin**
    - To check for updates, run the command: `BRAT: Check for updates to all beta plugins and UPDATE`
    - You can also enable auto-updates in BRAT settings to automatically update beta plugins when Obsidian starts

# Documentation

## Integrated Text Occlusion

### Motivation

> When I read my notes, I actually don't want to see everything. This way I know I'm never reading something without actually reviewing it.

### Description

Wrap text in a `[hide][/hide]` element to hide the text.

![text-hide](docs/images/text-hide.gif)

Click on the hidden text to reveal the text.

Use hide blocks to hide both inline and block level math.

![inline-math-hide](docs/images/inline-math-hide.gif)

![math-hide](docs/images/math-hide.gif)

### Hide Groups

Use hide groups to synchronize show/hide functionality across different hide blocks by assigning a **numerical** id to the hide block:

```markdown
-   This is a sentence which [hide=1]contains[/hide] a hide block with a group id.
-   This is a second sentence which [hide=1]contains[/hide] a hide block with the same group id.
```

![text-hide-groups](docs/images/text-hide-groups.gif)

## Image Occlusion

Add occlusions to images in your vault using the occlusion editor.

### Occlusion Editor

Double click on preview images to open them in the occlusion editor, or search and select them using the attachment search box.

### Preview Occlusions

Images with Occlusions which have been inserted as a preview using `![[]]` will appear with the occlusions added to the image in rendered markdown.

Click on the small circular blue button in the bottom right of the image to enable revealing the occlusion shapes by clicking on them. The button will turn green indicating that the occlusions can be clicked to reveal the image behind them.

Click on the now small circular green button to reset all occlusion shapes.

### Adding Occlusions

Click on the "+" button to add an occlusion onto the image.

#### Quick Add Occlusion

Enable the "Quick Add" option to add occlusions by dragging and releasing them to add them onto the image.

### HideOne/Hide All

With one or multiple occlusions selected, click on either "HideAll" or "HideOne" to create a flashcard which just contains the image and the selected occlusions.

-   HideAll
    -   Selected Occlusions will be able to be toggled, while all other occlusions will be permanent.
-   HideOne
    -   Selected Occlusions will be able to be toggled, while all other occlusions will not be present.

#### Keyboard/Mouse Controls

-   Scroll wheel - zoom in/out
-   Hold space - enable drag
-   Shift Click - select multiple occlusions
-   ctrl+z - Undo
-   ctrl+shift+z - Redo

## Flashcards

Create flashcards by wrapping content within a card element.

```markdown
[card]
Flashcards appear in the [hide]"Review Queue"[/hide]
[/card]
```

## Review Queue

Open the review queue using the "Review Queue" ribbon icon to see all flashcards within your vault.

![review-queue](docs/images/review-queue.png)

Flashcards in the Review Queue are scheduled using the same SM-2 algorithm used in Anki.

### Filter Options

-   **Due** - Shows all due flashcards
-   **Scheduled** - Shows all upcoming flashcards which are not due
-   **Note** - Shows all flashcards in current note
-   **All Cards** - Shows all flashcards

### Flashcard Modal

Upon clicking on the review button in the "Review Queue", flashcards will appear in the flashcard modal.

Click on one of the five rating buttons to input your easyness-factor rating.

## Flashcard Graph View

Open the Flashcard Graph View to see the Easyness Factor (EF) rating for all flashcards in your connected notes.

![graph](docs/images/graph.gif)

### Controls

Use the controls to change the visual appearance of the graph and modify the animation.

#### Graph Controls

-   Edge
-   Charge
-   Card Offset Distance
-   Card Size
-   Text Color

#### Animation Controls

-   Play/Pause
-   Start/End
-   Click on the timeline to track to a location
-   Speed of animation
-   Group by events by specific time intervals

#### Animation Grouping

-   None
-   Hour
-   Day
-   Week

## Drawings/Hand Written Notes

Open the drawing editor using the pencil ribbon icon.

![draw](docs/images/draw.gif)

Drawings are linked directly to notes, as indicated by the title preview of the associated tab.

Drawing view can be toggled to be either in the sidebar or a main view by using the associated control.

### Controls

#### Tools

##### Drawing Tools

-   Pen Brush
-   Handwriting Brush
-   Eraser Brush
-   Highlighter Brush
-   Freehand Selection Brush
-   Size Select
-   Color Select

#### Canvas Modes/Controls

##### Modes

-   Pan Mode
-   Stylus Only Mode (Excellent for when on a tablet)

##### Controls

-   Background Color Select
-   Save Button
-   Return to Home View Button
-   Undo Button
-   Redo Button
-   Set Home View Button
-   Toggle Sidebar/Main View
-   Clear Canvas

### Desired Features

-   Lined pages
-   Obsidian native links

## Chat Assistant

Use the chat editor to interact with your documents, and accomplish tasks such as creating new notes. Ask questions based on the context provided to the chat assistant.

Select from one the most up to date OpenAI models.

Use the context controls to control what chatGPT sees.

![chat](docs/images/chat.gif)

## Desired Features

-   Front/Back Style Cards
-   Drawing view integration
-   Prompt Basket Buttons

---

## Support

If you find this plugin helpful, consider supporting its development:

<div align="center">

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/datanoteable)

</div>

---

<div align="center">

Made with ❤️ by Bryce Davidson

</div>
