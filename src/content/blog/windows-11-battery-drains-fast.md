---
title: "Windows 11 Battery Drains Fast? 7 Fixes to Try"
description: "Is your Windows 11 battery draining fast? Try these 7 fixes, from lowering screen brightness to checking battery health with a Windows battery report."
pubDate: "Oct 01 2026"
heroImage: "/article-media/7-ways-to-fix-draining-laptop-windows.png"
category: "PC Troubleshooting"
tags: ["Windows", "PC Maintenance", "Troubleshooting", "Beginner Guide"]
---

<!-- SEO: title 43/60 characters, description 150/160 characters. Focus keyword: windows 11 battery drains fast fix -->

If your Windows 11 laptop battery drains fast, the cause may be a bright screen, a power-hungry app, an inefficient power setting, or an aging battery.

The seven fixes below start with the simplest steps. Most take between 1 and 10 minutes. After each fix, use the laptop normally and check whether the battery lasts longer. If the problem continues, move to the next fix.

## Before You Start

- Connect the charger while you apply the fixes.
- Confirm that the charger works. The battery icon should show that the laptop is charging.
- Note the battery percentage at the start of the day. Check it again later so you can compare the results.

## Fix 1: Lower the Brightness and Turn On Battery Saver

A bright display can use a significant amount of power. Lowering the brightness and enabling Battery saver can help extend the time between charges.

1. Open **Settings**.
2. Select **System > Power & battery**.
3. Move the **Brightness** slider to 50% or lower, if that level is comfortable for you.
4. Select **Battery saver**.
5. Set **Turn battery saver on at** to 20% or another level that works for you.

## Fix 2: Find the Apps Using the Most Power

Windows can show which apps have used the most battery. A demanding app, especially one that continues running in the background, may be responsible for much of the drain.

1. Open **Settings**.
2. Select **System > Power & battery**.
3. Select **Battery usage**.
4. Review the apps at the top of the list.
5. Select an app to see more details. If the app does not need to run in the background, change its background permission to **Never**, when that option is available.
6. Repeat these steps for other apps with unusually high usage.

Do not disable background activity for apps that need it for notifications, syncing, security, or other important functions.

## Fix 3: Shorten the Screen and Sleep Timers

Your laptop continues to use power while the screen is on. Shorter screen and sleep timers reduce battery use when you are away from the device.

1. Open **Settings**.
2. Select **System > Power & battery**.
3. Select **Screen and sleep**.
4. Set **Turn off my screen after** to 5 minutes when the laptop is running on battery.
5. Set **Put my device to sleep after** to 15 minutes on battery.

Choose longer times if these settings interrupt your work. Even a small reduction can help over the course of a day.

## Fix 4: Disable Unnecessary Startup Apps

Startup apps launch when Windows starts. Some continue running even when you are not using them, which can increase battery and memory use.

1. Right-click the **Start** button.
2. Select **Task Manager**.
3. Select **Startup apps**.
4. Review each app's **Startup impact**.
5. Disable apps that you do not need when you sign in.
6. Restart the computer.

Keep security software and other apps that you need for work or notifications enabled.

## Fix 5: Turn Off Unused Wireless Connections and Syncing

Wi-Fi, Bluetooth, and file-syncing services can use power while they run in the background. Turn off connections and syncing only when you do not need them.

- Select the **network** icon on the taskbar.
- If you do not need internet access, select the **Wi-Fi** button to turn it off.
- If no device is connected or needs Bluetooth, turn off **Bluetooth**.
- Select the **OneDrive** icon in the taskbar.
- Select **Pause syncing**, then choose **2 hours**.

Remember to turn these services back on when you need internet access, connected devices, or up-to-date files.

## Fix 6: Restore the Default Power Schemes

A changed or corrupted power configuration can affect how Windows manages power. You can restore the default power schemes with a Command Prompt command.

**Warning:** This command removes custom power schemes and power settings. Do not use it if you need to keep custom power settings.

1. Select **Search** on the taskbar.
2. Type `cmd`.
3. Select **Run as administrator** for **Command Prompt**.
4. Run this command:

```text
powercfg -restoredefaultschemes
```

5. Restart the computer.
6. Use the laptop for a day and compare its battery use with your earlier result.

## Fix 7: Check the Battery Report

Windows can create a battery report with details about the battery's original design capacity and its current full-charge capacity. This can help you determine whether the battery has worn out.

1. Select **Search** on the taskbar.
2. Type `cmd`.
3. Select **Run as administrator** for **Command Prompt**.
4. Run this command:

```text
powercfg /batteryreport
```

5. Read the command's output to find the location of the report. If you run Command Prompt as an administrator, it is often saved as `C:\Windows\System32\battery-report.html`.
6. Open the report in a web browser.
7. Find **DESIGN CAPACITY** and **FULL CHARGE CAPACITY**.

If the full-charge capacity is much lower than the design capacity, the battery has lost some of its original capacity. A replacement battery may restore some of the laptop's run time. Check your laptop manufacturer's guidance before buying a replacement.

## Frequently Asked Questions

### Why does my Windows 11 battery drain so fast?

A bright display, demanding apps, background activity, wireless connections, and an aging battery can all reduce battery life. Start by checking **Settings > System > Power & battery > Battery usage** to find apps with unusually high consumption.

### Does Battery saver protect the battery?

Battery saver is designed to reduce power use and extend the time between charges. It does not repair an aging battery or guarantee longer overall battery health.

### How long does a laptop battery last?

Battery life varies by laptop, battery capacity, workload, screen brightness, and battery age. Video calls, games, video playback, and other demanding tasks usually use more power than light web browsing or document work.

### Can a Windows update drain the battery?

A large Windows update may temporarily increase battery and processor use while it downloads, installs, and indexes files. Usage may return to normal after the update finishes. If the drain continues, check the battery-usage list and the battery report.

## If the Problem Continues

If these fixes do not reduce the drain, the cause may be a worn battery, faulty hardware, a connected USB device, or a background process that is using unusual amounts of power.

Disconnect unnecessary USB devices and check **Battery usage** again. If the battery report shows significant wear, contact the laptop manufacturer or a qualified repair technician. A technician can test the battery and inspect the laptop for hardware problems.

## Related Articles

- [Fix Windows 11 Stuck on Getting Updates Loop in 5 Steps](/blog/how-to-fix-windows-11-stuck-on-getting-updates-loop/)
- [Windows 11 No Sound After Update? 7 Ways to Get It Back](/blog/windows-11-no-sound-after-update/)
- [Simple Tips to Solve Your PC Startup and Shutdown Problems](/blog/simple-tips-to-solve-your-pc-startup-and-shutdown-problems/)

<!-- Add this link when the article is published:
- [7 Fixes for a Windows 11 Taskbar and Start Menu Missing](/blog/windows-11-taskbar-start-menu-not-showing/)
-->
