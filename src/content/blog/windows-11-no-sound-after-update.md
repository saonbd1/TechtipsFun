---
title: "Windows 11 No Sound After Update? 7 Ways to Get It Back"
description: "Windows 11 has no sound after an update? Run 7 fixes, from the output device to a driver rollback and a Windows update removal."
pubDate: "Sep 30 2026"
heroImage: "/article-media/windows-11-no-sound-after-update.png"
category: "PC Troubleshooting"
tags: ["Windows", "PC Maintenance", "Troubleshooting", "Beginner Guide"]
---

<!-- SEO: title 55/60 chars, description 127/160 chars. Focus keyword: windows 11 no sound after update how to fix -->

A Windows update can stop the sound. The volume icon shows a mute symbol, or the speakers stay silent. This problem has four common causes: a wrong output device, a stopped audio service, a faulty driver, or the update itself.

The fixes below start with the easiest one. Each fix takes 1 to 10 minutes. If one fix does not work, continue to the next fix.

## Before You Start

- Save your open work.
- Test your speakers or headphones on another device.
- If the sound works on the other device, continue with Fix 1.

## Fix 1: Select the Output Device and the Volume

Windows can select the wrong output device after an update. Windows can also set the volume of one app to zero.

- Open Settings.
- Select System > Sound.
- Select your speakers or headphones under Output.
- Move the volume slider to 50 percent or higher.
- Select Volume mixer. If an app volume is low, move its slider up.
- Test the sound.

![Select the output device and volume in Windows 11 Sound settings](/article-media/windows-11-no-sound-fix1-output-device.png)

## Fix 2: Run the Audio Troubleshooter

Windows has a troubleshooter that repairs common sound errors. The Get Help app contains the same troubleshooter.

- Open Settings.
- Select System > Troubleshoot > Other troubleshooters.
- Select Run for Audio Playback.
- Wait for the troubleshooter to finish.
- Test the sound after the troubleshooter closes.

![Run the Audio Playback troubleshooter in Windows 11](/article-media/windows-11-no-sound-fix2-troubleshooter.png)

## Fix 3: Restart the Audio Services

Every sound on Windows runs through two services: Windows Audio and Windows Audio Endpoint Builder. Without these services, the sound stops.

- Press Windows + R.
- Type services.msc and select OK.
- Find Windows Audio in the list.
- Make sure that the Startup type is Automatic.
- Right-click Windows Audio and select Restart.
- Repeat these steps for Windows Audio Endpoint Builder.
- Test the sound.

![Restart Windows Audio services in services.msc](/article-media/windows-11-no-sound-fix3-audio-services.png)

## Fix 4: Turn Off Audio Enhancements and Spatial Sound

Audio enhancements can stop the sound after a driver update. Spatial sound can also block the output.

- Open Settings.
- Select System > Sound.
- Select your output device under Output.
- Set Audio enhancements to Off.
- Set Spatial sound to Off.
- Test the sound.

## Fix 5: Roll Back the Audio Driver

The update can install a faulty driver. Windows stores the earlier driver on the computer. The rollback restores this driver.

- Select Search on the taskbar.
- Type Device Manager and select Device Manager.
- Expand Sound, video and game controllers.
- Right-click your audio device and select Properties.
- Select the Driver tab.
- Select Roll Back Driver.
- Follow the instructions. Then restart the computer.
- If the Roll Back Driver button is gray, Windows does not have an earlier driver. Continue with Fix 6.

![Roll back or reinstall the audio driver in Device Manager](/article-media/windows-11-no-sound-fix5-device-manager.png)

## Fix 6: Reinstall the Audio Driver

Windows installs a new driver after the restart. The driver from the computer manufacturer can work better than the Windows driver.

CAUTION: Do not select a box that removes the driver file. Windows needs this file to install the device again.

- Open Device Manager.
- Expand Sound, video and game controllers.
- Right-click your audio device.
- Select Uninstall device.
- If Windows asks for it, select Uninstall.
- Restart the computer.

## Fix 7: Remove the Windows Update

Some updates break the sound. Windows can remove the last update. The sound then works again.

CAUTION: Windows can install the update again later. A repair update from Microsoft can also arrive.

- Open Settings.
- Select Windows Update.
- Select Update history.
- Select Uninstall updates.
- Select the last update and select Uninstall.
- Restart the computer.
- If the sound works, pause the updates until Microsoft sends a repair.

![Uninstall the last Windows update from Update history](/article-media/windows-11-no-sound-fix7-update-history.png)

## Frequently Asked Questions

### Why did the update stop the sound?

The update can change the audio driver or the sound settings. A faulty driver is the most common cause. Fix 5 and Fix 6 repair the driver.

### Does a restart fix no sound after an update?

A restart starts the audio services again. For some computers, this is enough. Fix 3 restarts the two services directly.

### Does removing the update delete my files?

No. The removal keeps your files and apps. Windows installs the update again later.

### How long do the fixes take?

Most fixes take 1 to 10 minutes. The driver fixes need one restart.

## If the Problem Continues

If these fixes do not restore the sound, the audio hardware can be faulty. A USB sound card gives a fast test for this computer. If the sound works on the USB sound card, the sound chip on the motherboard failed. The repair then needs a computer technician.

## Related Articles

- [Fix Windows 11 Stuck on Getting Updates Loop in 5 Steps](/blog/how-to-fix-windows-11-stuck-on-getting-updates-loop/)
- [Why Windows 11 Keeps Disconnecting Wi-Fi, and How to Fix It](/blog/windows-11-wifi-keeps-disconnecting/)
- [How to Repair Corrupted Windows 11 System Files with SFC and DISM](/blog/how-to-repair-corrupted-windows-11-system-files-sfc-dism/)

<!-- Add these links when the articles are published:
- [7 Ways to Fix a Fast-Draining Windows 11 Battery](/blog/windows-11-battery-drains-fast/)
- [7 Fixes for a Windows 11 Taskbar and Start Menu Missing](/blog/windows-11-taskbar-start-menu-not-showing/)
-->
