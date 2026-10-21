# DeepSeek در قالب API (راهنمای ساده)

[English](README_en.md) · [فارسی](README_fa.md)

با این برنامه می‌توانید از داخل برنامه‌های دیگر (مثل Cursor یا Claude Code) با حساب DeepSeek خودتان چت کنید. برنامه چت وب DeepSeek را به یک API تبدیل می‌کند.

> این برنامه رسمی نیست و به DeepSeek وابسته نیست. با حساب شخصی شما کار می‌کند. فقط **متن** پشتیبانی می‌شود، نه عکس.

## ۱. چه چیزهایی لازم دارید؟

- یک کامپیوتر با ویندوز، مک یا لینوکس
- **Python 3.10** یا جدیدتر — از [python.org/downloads](https://www.python.org/downloads/) نصب کنید.
  - در ویندوز موقع نصب، تیک **Add python.exe to PATH** را بزنید.
- یک حساب در [chat.deepseek.com](https://chat.deepseek.com)
- اینترنت

## ۲. نصب

**روش ساده (بدون git):**

**گام ۱:** بالای همین صفحه، دکمهٔ سبز **Code** → **Download ZIP** را بزنید.

**گام ۲:** فایل ZIP را از حالت فشرده خارج کنید.

**گام ۳:** داخل پوشه، ترمینال را باز کنید:

- ویندوز: `Shift` + کلیک راست در پوشه → **Open PowerShell window here**
- مک/لینوکس: Terminal را باز کنید و با `cd` به پوشه بروید.

**گام ۴:** این دستور را اجرا کنید:

ویندوز:
```powershell
py -3 scripts\install.py
```

مک و لینوکس:
```bash
python3 scripts/install.py
```

**گام ۵:** وقتی نوشت **Installation complete**، پنجره را ببندید و یک ترمینال **جدید** باز کنید.

**گام ۶:** بنویسید:

```bash
ds2api
```

**روش دوم (اگر git دارید):**

```bash
git clone https://github.com/Rezayavarzade123/deepseek-web2api-farsi.git
cd deepseek-web2api-farsi
python3 scripts/install.py
```

> در ویندوز به‌جای خط آخر `py -3 scripts\install.py` را بزنید.

اگر Node.js 20 یا جدیدتر داشته باشید، پنل گرافیکی هم ساخته می‌شود. اگر نداشته باشید، فقط API نصب می‌شود؛ بعداً Node.js را نصب کنید و نصب‌کننده را دوباره اجرا کنید.

## ۳. ورود به پنل

مرورگر را باز کنید و این نشانی را بزنید:

```
http://127.0.0.1:8080/webui/
```

رمز پیش‌فرض: `admin`

## ۴. اضافه کردن حساب DeepSeek

1. در مرورگر وارد [chat.deepseek.com](https://chat.deepseek.com) شوید.
2. کلید `F12` را بزنید و تب **Network** را انتخاب کنید.
3. یک پیام بفرستید و روی درخواست چت کلیک کنید.
4. از بخش **Request Headers** دو چیز را کپی کنید:
   - `Authorization` → فقط بخش بعد از `Bearer ` (این می‌شود **Token**)
   - `Cookie` → کل مقدار (این می‌شود **Cookies**)
5. در پنل بروید به **Account Pool** → **Add account** و این دو را بچسبانید.

در Chrome، Edge یا Brave می‌توانید از [ابزار کمکی کپی سریع](tools/chromium-credential-capture/README_fa.md) استفاده کنید.

> این دو مقدار مثل رمز عبور هستند: به کسی ندهید و در گفتگو یا سایت عمومی نگذارید.

## ۵. ساخت کلید API

در پنل بروید به **Settings** و یک کلید بسازید. کلید فقط **یک بار** نشان داده می‌شود؛ همان‌جا کپی کنید.

## ۶. آزمایش

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-flash","messages":[{"role":"user","content":"سلام"}]}'
```

اگر جواب آمد، همه چیز درست کار می‌کند. به‌جای `YOUR_CLIENT_API_KEY` کلید خودتان را بگذارید.

## ۳ کار مهم

1. رمز `admin` را عوض کنید: در فایل `.env` مقدار `DEEPSEEK_ADMIN_PASSWORD` را تغییر دهید و برنامه را دوباره اجرا کنید.
2. برنامه را روی اینترنت باز نکنید؛ فقط روی همین کامپیوتر استفاده کنید.
3. Token و Cookie را برای هیچ‌کس نفرستید.

## اگر کار نکرد

| مشکل | راه حل |
|---|---|
| `ds2api` شناخته نمی‌شود | ترمینال را ببندید و دوباره باز کنید. اگر حل نشد، نصب‌کننده را دوباره اجرا کنید. |
| پنل باز نمی‌شود | مطمئن شوید `ds2api` در حال اجراست و پورت 8080 آزاد است. |
| حساب خطا می‌دهد | Token و Cookie را دوباره از سایت بگیرید و حساب را از نو اضافه کنید. |
| عکس فرستادم و خطا داد | این برنامه فقط متن قبول می‌کند. |
| `Python was not found` | پایتون را نصب کنید و تیک Add to PATH را بزنید. |
| `ModuleNotFoundError` | نصب‌کننده را دوباره اجرا کنید تا وابستگی‌ها نصب شوند. |

## تغییر تنظیمات (اختیاری)

تنظیمات در فایل `.env` هستند. مهم‌ترین‌ها:

| متغیر | پیش‌فرض | کار |
|---|---|---|
| `PORT` | `8080` | پورت برنامه |
| `DEEPSEEK_ADMIN_PASSWORD` | `admin` | رمز پنل؛ عوضش کنید |
| `MODEL_NAME` | `deepseek-flash` | نام مدل در پاسخ‌ها |
| `HOST` | `127.0.0.1` | آدرس گوش‌دادن؛ برای استفادهٔ شخصی همین خوب است |

فهرست کامل: [`.env.example`](.env.example)

## حذف برنامه

ویندوز:
```powershell
py -3 "$env:LOCALAPPDATA\Programs\DS2API\scripts\uninstall.py"
```

مک و لینوکس:
```bash
python3 ~/.local/share/ds2api/scripts/uninstall.py
```

تنظیمات و حساب‌ها باقی می‌مانند. برای حذف کامل آن‌ها `--purge-user-data` را اضافه کنید.

## بیشتر بدانید

- راهنمای کامل و جزئیات API (انگلیسی): [README_en.md](README_en.md)
- همهٔ تنظیمات: [`.env.example`](.env.example)
- یادداشت فنی برای برنامه‌نویس‌ها: [AGENTS.md](AGENTS.md)
