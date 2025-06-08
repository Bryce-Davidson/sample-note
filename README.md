<div align="center">

# Sample Note Beta

![cover](docs/images/cover.gif)

[![Version](https://img.shields.io/badge/version-0.1.26-blue.svg)](https://github.com/bryce-davidson/sample-note/releases)

**[Features](#features)** • **[Installation](#installation)** • **[Documentation](#documentation)** • **[Support](#support)**

<a href="https://buymeacoffee.com/datanoteable" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

</div>

---

## About

I've always loved Obsidian and have been a supporter from nearly the beginning, but I found it tedious to synchronize my notes with other forms of learning programs such as Anki, GoodNotes, etc.

To remedy this, I've created a plugin to make Obsidian my single source of truth by replicating my favourite features from all different kinds of learning tools within Obsidian.

I hope you enjoy.

-   Bryce

## Features

## GoodNotes Style Handwriting

Keep handrwitten notes directly in Obsidian and linked to your notes using the GoodNotes style drawing editor.

![draw](docs/images/draw.gif)

### Integrated Text Occlusion & Flashcards

Hide content within your notes to ensure you are reviewing the material as you read (can toggle this mode to see notes normally).

Create and review flashcards without having to synchronize to Anki. Your flashcards automatically update as your notes change.

![flashcard](docs/images/flashcard.gif)

## Integrated Image Occlusion

Create, preview, and review image occlusions directly within Obsidian bot within your notes as you read them and as flashcards.

![occlusion](docs/images/occlusions.gif)

## Flashcard Graph

Track your learning progress with the interactive flashcard graph to visualize your study patterns. The graph animates and highlights flashcards whichb need improvement while showing the relationships between different cards. This visualization helps you optimize your study sessions by focusing on the cards that need the most attention.

![graph](docs/images/graph.gif)

## Copilot Chat Assistant

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

## Feature

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

## HideOne/Hide All

With one or multiple occlusions selected, click on either "HideAll" or "HideOne" to create a flashcard which just contains the image and the selected occlusions.

-   HideAll
    -   Selected Occlusions will be able to be toggled, while all other occlusions will be permanant.
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
