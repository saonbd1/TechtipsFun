---
title: "How to Repair Corrupted Windows 11 System Files with SFC and DISM"
description: "Learn how to run SFC and DISM in Windows 11, why DISM RestoreHealth should come first, and what to do when SFC cannot fix corrupted files."
pubDate: "Aug 28 2026"
heroImage: "/windows11-sfc-dism-cover.png"
category: "PC Troubleshooting"
tags: ["Windows", "PC Maintenance", "Troubleshooting", "Command Line", "Beginner Guide"]
---

If you are running Windows 11 operating system, it may become unstable when any protected system files are missing, damaged, or changed. You may noticed some common symptoms like repeated error messages, some Windows features that suddenly stopped working, failed automatic updates, application crashes, freezing, or unexpected restarts. To fix these Micorosoft team includes two built-in tools on Windows 11 that can easily repair this type of problems: **Deployment Image Servicing and Management (DISM)** and **System File Checker (SFC)**.

The standard repair sequence is simple: run **DISM RestoreHealth**, wait for it to finish successfully, and then run **sfc /scannow**. DISM repairs the Windows component store that supplies replacement files, while SFC checks protected system files and replaces damaged copies when possible.

## Quick answer: the correct SFC and DISM Windows 11 commands

Open **Command Prompt as administrator** and run these commands separately:

```text
DISM.exe /Online /Cleanup-Image /RestoreHealth
```

After DISM reports that the operation completed successfully, run:

```text
sfc /scannow
```

This is the recommended **DISM RestoreHealth then sfc scannow** order. Do not close the Command Prompt window while either operation is running. Microsoft specifically advises waiting until SFC reaches 100 percent verification.

## What are DISM and SFC?

Although both tools repair Windows, they work at different levels. DISM repairs the Windows image and component store. SFC then uses the repaired store or its cached copies to verify protected operating-system files.

**DISM** repairs the Windows image and component store. Run it first with `DISM.exe /Online /Cleanup-Image /RestoreHealth`. The `/Online` option targets the Windows installation that is currently running. The `/Cleanup-Image` option selects image servicing, and `/RestoreHealth` tells DISM to scan for component-store corruption and repair it.

**SFC** scans protected system files and replaces damaged files when a suitable replacement is available. Run it after DISM with `sfc /scannow`. SFC can use the repaired component store or its cached copies to restore protected operating-system files.


> Microsoft recommends running DISM before the System File Checker because DISM provides the files required to repair corrupted system files.

## Before you run the repair commands

Save your open work and connect the computer to reliable power. The scans can take time, and the apparent progress may pause for several minutes. Avoid restarting, shutting down, or closing the command window during a scan.

It is also sensible to install pending Windows updates and restart the computer before starting. Microsoft includes updating and restarting among its preliminary steps for using SFC. If your pc is unstable, back up important personal files first. SFC and DISM are designed to repair Windows components, but a backup protects your data if the underlying problem is a failing drive or another hardware fault.

## How to run SFC and DISM in Windows 11

### 1. Open an elevated Command Prompt

Select the Search button on the Windows 11 taskbar and type **Command Prompt**. Right-click **Command Prompt**, select **Run as administrator**, and approve the User Account Control prompt. Administrative access is required for these repair operations.

### 2. Run DISM RestoreHealth

Type the following command exactly, including the spaces, and press Enter:

```text
DISM.exe /Online /Cleanup-Image /RestoreHealth
```

DISM may use Windows Update to obtain the files it needs for repair. The process can take several minutes. Wait for a successful completion message before moving to the next command.

If DISM finishes successfully, continue with SFC. If it returns an error, record the error code and message instead of repeatedly running random commands. A damaged Windows Update client, insufficient free space, a disconnected repair source, or a deeper system problem may require additional troubleshooting. If Windows remains stuck while applying updates, follow our guide to [fixing the Windows 11 update loop](/blog/how-to-fix-windows-11-stuck-on-getting-updates-loop/).

### 3. Run SFC /SCANNOW

In the same administrator Command Prompt window, type:

```text
sfc /scannow
```

Press Enter and wait until the verification reaches **100 percent**. SFC scans protected system files and replaces corrupted files with a cached copy when a suitable replacement is available.

When the scan finishes, read the result message. It will indicate whether Windows found no integrity violations, repaired the files, or could not repair some of them.

### 4. Restart Windows

After the commands finish, restart Windows 11 and check whether the original problem has improved. If the issue was caused by damaged system components, the repair may restore normal operation. If the problem continues, it may not be caused by system-file corruption alone.

## What the SFC result means

SFC provides a useful summary at the end of the scan. The wording may vary slightly by Windows version, but the main outcomes are consistent.

SFC can report several different results after the scan. If Windows Resource Protection did not find any integrity violations, SFC did not detect missing or corrupted protected system files. Restart Windows if needed. If the problem remains, investigate Windows updates, drivers, applications, malware, or hardware.

If Windows Resource Protection found corrupt files and successfully repaired them, SFC found damaged files and repaired them. Restart Windows and test the system again.

If Windows Resource Protection found corrupt files but was unable to fix some of them, some files remain damaged or the required replacement source was unavailable. Review the SFC details, confirm that DISM completed successfully, and use Windows recovery options if the issue continues.

If Windows Resource Protection could not perform the requested operation, SFC could not complete the scan. Try running the scan in Safe Mode and check the conditions Microsoft documents for this result.

<ul>
<li><strong>No integrity violations:</strong> SFC found no missing or corrupted protected system files. Restart if needed, then investigate other possible causes if the problem remains.</li>
<li><strong>Corrupt files repaired:</strong> SFC found damaged files and repaired them. Restart Windows and test the system again.</li>
<li><strong>Some corrupt files could not be repaired:</strong> Review the SFC details, confirm DISM completed successfully, and use Windows recovery options if necessary.</li>
<li><strong>Requested operation could not be performed:</strong> Run SFC in Safe Mode and review Microsoft's documented troubleshooting conditions.</li>
</ul>

## What to do when sfc /scannow cannot fix corrupted files

The message **“Windows Resource Protection found corrupt files but was unable to fix some of them”** does not necessarily mean that Windows cannot be repaired. It means SFC could not repair every file during that run. Use the following process.

### Run DISM first if you did not already do so

SFC may be unable to repair files when the Windows component store that supplies replacement files is itself damaged. Run the following command from an administrator Command Prompt:

```text
DISM.exe /Online /Cleanup-Image /RestoreHealth
```

After DISM completes successfully, run SFC again:

```text
sfc /scannow
```

The important sequence is **DISM RestoreHealth then sfc scannow**, not the other way around. This gives SFC a better source for the files it needs.

### Review the SFC details in CBS.log

SFC records verification and repair information in the Component Based Servicing log, commonly called **CBS.log**. Microsoft identifies the log location as:

```text
%windir%\Logs\CBS\CBS.log
```

To extract SFC-related entries into a readable file on the desktop, run this command in an administrator Command Prompt:

```text
findstr /c:"[SR]" %windir%\Logs\CBS\CBS.log >"%userprofile%\Desktop\sfcdetails.txt"
```

Open **sfcdetails.txt** and review the entries from the most recent scan. The file can contain records from earlier SFC runs, so check the date and time before deciding which files remain unrepaired.

Do not download replacement DLL files from unverified websites. A file with the correct name may still be the wrong Windows version, modified, infected, or incompatible with the installed build. Manual replacement is an advanced procedure and should not be the first response to an SFC failure.

### Try Safe Mode when SFC cannot complete

If SFC says that it could not perform the requested operation, Microsoft recommends performing the scan in Safe Mode. Safe Mode starts Windows with a limited set of drivers and services, which can help when a third-party program or service interferes with the repair.

To reach Safe Mode, open **Settings > System > Recovery**, choose **Restart now** beside Advanced startup, and then select **Troubleshoot > Advanced options > Startup Settings > Restart**. Choose the Safe Mode option after Windows restarts. The exact menu wording may change between Windows 11 builds, so use the recovery instructions shown on your screen.

Once Safe Mode has loaded, open an administrator Command Prompt and run:

```text
sfc /scannow
```

### Use a repair source if Windows Update is unavailable

By default, DISM may use Windows Update as the source for repair files. If Windows Update is broken or the required files cannot be obtained, Microsoft documents using a known Windows installation or another valid side-by-side repair source.

The general form is:

```text
DISM.exe /Online /Cleanup-Image /RestoreHealth /Source:C:\RepairSource\Windows /LimitAccess
```

Replace `C:\RepairSource\Windows` with the path to a valid repair source that matches the installed Windows version and edition. Do not guess this path or use files from an unrelated Windows build. If you do not have a known-good matching source, use Microsoft’s Windows recovery and installation guidance rather than downloading an arbitrary image.

## When SFC and DISM do not solve the problem

SFC and DISM repair certain types of Windows component and protected-file corruption. They do not fix every cause of crashes, slow performance, boot failures, or update errors. Persistent symptoms can also result from failing storage, defective memory, a problematic driver, malware, overheating, a damaged user profile, or an incompatible application.

If the commands complete but the problem remains, install current Windows updates, review recently installed drivers and applications, and check the relevant Windows recovery options. If Windows is still unstable and the repair tools cannot resolve the corruption, Microsoft notes that reinstalling Windows may be necessary. Back up personal data before using a reset or reinstall option, and select the recovery method that matches your situation.

## Frequently asked questions

### Should I run SFC or DISM first in Windows 11?

Run **DISM first**, using `DISM.exe /Online /Cleanup-Image /RestoreHealth`, and then run `sfc /scannow`. Microsoft recommends this order because DISM can repair the component store that SFC relies on for replacement files.

### Can I run DISM and SFC at the same time?

No. Run them one at a time in the same administrator Command Prompt. Wait for DISM to finish successfully before starting SFC.

### How long do SFC and DISM take?

The time depends on the computer, the condition of Windows, available storage, and whether DISM must obtain repair files. The progress may appear to pause, so allow the command to continue rather than interrupting it.

### What if SFC says there are no integrity violations but Windows still has problems?

That result means SFC did not find corruption in the protected system files it checks. The cause may be outside those files, such as a driver, application, update, user profile, hardware fault, or malware. Continue troubleshooting the specific symptom instead of repeatedly running SFC.

### Is `DISM RestoreHealth then sfc scannow` the correct search phrase and repair order?

Yes. As a command sequence, the correct order is DISM’s `/RestoreHealth` operation followed by `sfc /scannow`. The phrase “DISM RestoreHealth then sfc scannow” describes the recommended workflow, but the commands must still be entered separately and from an elevated Command Prompt.

## Final takeaway

To **repair corrupted Windows 11 system files**, open Command Prompt as administrator and run:

```text
DISM.exe /Online /Cleanup-Image /RestoreHealth
```

Wait for successful completion, then run:

```text
sfc /scannow
```

If **SFC cannot fix corrupted files**, run DISM first if necessary, repeat SFC, review the `[SR]` entries in CBS.log, and use Safe Mode or Windows recovery options when appropriate. These tools are effective first-line repairs, but persistent problems may point to an update, driver, application, malware, or hardware issue rather than Windows system files alone.
