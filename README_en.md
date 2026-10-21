# DeepSeek Web Chat as an API (Simple Guide)

[فارسی](README.md) · [English](README_en.md)

This program lets you chat with your own DeepSeek account from other apps (like Cursor or Claude Code). It turns the DeepSeek web chat into an API.

> This is not an official DeepSeek project. It works with your personal account. Only **text** is supported, not images.

## 1. What you need

- A computer with Windows, macOS, or Linux
- **Python 3.10** or newer — install it from [python.org/downloads](https://www.python.org/downloads/)
  - On Windows, tick **Add python.exe to PATH** during installation.
- An account at [chat.deepseek.com](https://chat.deepseek.com)
- Internet

## 2. Install

**Easy way (no git):**

**Step 1:** Click the green **Code** button at the top of this page → **Download ZIP**.

**Step 2:** Unzip the file.

**Step 3:** Open a terminal inside that folder:

- Windows: `Shift` + right-click in the folder → **Open PowerShell window here**
- macOS/Linux: open Terminal and use `cd` to go to the folder.

**Step 4:** Run this command:

Windows:
```powershell
py -3 scripts\install.py
```

macOS / Linux:
```bash
python3 scripts/install.py
```

**Step 5:** When it says **Installation complete**, close the window and open a **new** terminal.

**Step 6:** Type:

```bash
ds2api
```

**Second way (if you have git):**

```bash
git clone https://github.com/Rezayavarzade123/deepseek-web2api-farsi.git
cd deepseek-web2api-farsi
python3 scripts/install.py
```

> On Windows, use `py -3 scripts\install.py` for the last line.

If you have Node.js 20 or newer, the graphical panel is built too. If not, only the API is installed; install Node.js later and run the installer again.

## 3. Open the panel

Open your browser and go to:

```
http://127.0.0.1:8080/webui/
```

Default password: `admin`

## 4. Add your DeepSeek account

1. In your browser, sign in at [chat.deepseek.com](https://chat.deepseek.com).
2. Press `F12` and open the **Network** tab.
3. Send a message and click the chat request.
4. From **Request Headers**, copy two things:
   - `Authorization` → only the part after `Bearer ` (this is the **Token**)
   - `Cookie` → the whole value (this is the **Cookies**)
5. In the panel go to **Account Pool** → **Add account** and paste both.

In Chrome, Edge, or Brave you can use the [copy helper](tools/chromium-credential-capture/README.md).

> These two values are like a password: never share them, and never post them in chats or public sites.

## 5. Create an API key

In the panel go to **Settings** and create a key. The key is shown only **once**; copy it right there.

## 6. Test it

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-flash","messages":[{"role":"user","content":"Hello"}]}'
```

If you get an answer, everything works. Replace `YOUR_CLIENT_API_KEY` with your own key.

## 3 important things

1. Change the `admin` password: edit `DEEPSEEK_ADMIN_PASSWORD` in the `.env` file and restart the program.
2. Do not open the program to the internet; use it only on this computer.
3. Never send your Token and Cookie to anyone.

## If it does not work

| Problem | Fix |
|---|---|
| `ds2api` is not recognized | Close the terminal and open it again. If that does not help, run the installer again. |
| The panel does not open | Make sure `ds2api` is running and port 8080 is free. |
| The account shows an error | Copy the Token and Cookie from the site again and add the account again. |
| I sent an image and got an error | This program accepts text only. |
| `Python was not found` | Install Python and tick Add to PATH. |
| `ModuleNotFoundError` | Run the installer again so dependencies get installed. |

## Settings (optional)

Settings live in the `.env` file. The most important ones:

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | Program port |
| `DEEPSEEK_ADMIN_PASSWORD` | `admin` | Panel password; change it |
| `MODEL_NAME` | `deepseek-flash` | Model name in responses |
| `HOST` | `127.0.0.1` | Listening address; this is good for personal use |

Full list: [`.env.example`](.env.example)

## Uninstall

Windows:
```powershell
py -3 "$env:LOCALAPPDATA\Programs\DS2API\scripts\uninstall.py"
```

macOS / Linux:
```bash
python3 ~/.local/share/ds2api/scripts/uninstall.py
```

Settings and accounts are kept. Add `--purge-user-data` to remove them too.

## Learn more

- Full English guide: [docs/technical-guide-en.md](docs/technical-guide-en.md)
- All settings: [`.env.example`](.env.example)
- Technical notes for developers: [AGENTS.md](AGENTS.md)
