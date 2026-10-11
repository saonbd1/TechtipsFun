---
title: "Update TPM firmware in Windows 11: A safe step-by-step guide"
description: "Learn how to update TPM firmware in Windows 11, clear TPM safely, protect BitLocker data, and fix TPM detection and initialization errors."
pubDate: "Sep 28 2026"
heroImage: "/windows_wifi_cover.webp"
category: "PC Troubleshooting"
tags: ["Windows", "Open Source", "Free Tools", "How to"]

---

A Trusted Platform Module (TPM) is a security component built into your computer. Windows 11 relies on TPM 2.0 for features such as Windows Hello and BitLocker. If the TPM is outdated, damaged, disabled, or missing from Windows, you may see security warnings or have trouble completing setup.

This guide covers TPM firmware updates in Windows 11, safe ways to clear the TPM, BitLocker recovery steps, and common TPM detection and initialization problems. Read the safety information before changing anything.

> **Important:** Do not clear the TPM until you have a recovery method for every key and credential it protects. Clearing the TPM can affect BitLocker, Windows Hello PINs, virtual smart cards, and other security features.

## Check the TPM status before making changes

Start by confirming that Windows can see the TPM and checking its specification version.

### Use Windows Security

1. Open **Settings**.
2. Select **Privacy & security**.
3. Select **Windows Security**.
4. Select **Device security**.
5. Select **Security processor details**.
6. Read the **Specification version** value.

![security processor details](/security-processor-details.png)

Windows 11 requires version **2.0**. If the Security processor section is missing, the TPM may be disabled in UEFI firmware, hidden from Windows, unsupported, or affected by a hardware or firmware problem.  

### Use TPM Management

1. Press **Windows + R**.
2. Type `tpm.msc`.
3. Select **OK**.
4. Read the status message in the TPM Management window.
5. Under **TPM Manufacturer Information**, check the **Specification Version** value.

If Windows says **Compatible TPM cannot be found**, the TPM may be disabled in UEFI firmware. If the TPM is ready for use but its version is below 2.0, the device does not meet the Windows 11 TPM requirement.  

## Prepare for a TPM firmware update

A TPM firmware update can change the TPM's state. A BIOS or UEFI update can also cause BitLocker to request its recovery key. Before you begin:

- Back up important files.
- Find and save the BitLocker recovery key.
- Confirm that you can sign in to your Microsoft account or work account.
- Record your Windows Hello sign-in method.
- Connect the computer to AC power.
- Read the firmware instructions from the computer manufacturer.
- Do not use firmware intended for a different computer model.
- Do not interrupt the computer while the update is running.
- Ask your IT administrator before changing a work or school computer.

If BitLocker protects the system drive, suspend protection when the manufacturer's instructions call for it. Resume protection after the update finishes. Keep the recovery key; do not delete it or assume you will not need it.

## How to update TPM firmware in Windows 11

TPM firmware usually comes from the computer or motherboard manufacturer. Windows Update can install operating system updates, but it does not replace every device-specific TPM firmware package. If you having problem with [windows updating see this how to fix that](https://www.techtips.fun/blog/how-to-fix-windows-11-stuck-on-getting-updates-loop/)

### Step 1: Install Windows updates first

1. Open **Settings**.
2. Select **Windows Update**.
3. Select **Check for updates**.
4. Install all applicable updates.
5. Restart the computer when Windows asks you to.

![windows update settings](/windows-update.png)

For some TPM security updates, Microsoft recommends installing the Windows operating system update before the TPM firmware update.  

### Step 2: Find the correct firmware package

Go to your computer manufacturer's support page and search by the exact model name or service tag. The package may be called **TPM firmware**, **security processor firmware**, **UEFI update**, or **BIOS update**.

Before downloading it, check that:

- The computer model matches your device.
- The package supports Windows 11.
- The package lists the required TPM manufacturer or version.
- The release notes describe the TPM problem the package addresses.
- The instructions explain whether you must suspend BitLocker.

For a custom desktop, use the motherboard manufacturer's support page. Avoid TPM firmware packages from unknown websites.

### Step 3: Install the firmware update

1. Close open applications.
2. Connect the computer to AC power.
3. Suspend BitLocker protection if the manufacturer's instructions require it.
4. Start the firmware installer as an administrator.
5. Read the warning messages.
6. Start the update.
7. Allow the computer to restart.
8. Do not turn off the computer during the update.
9. Wait for Windows to start again.
10. Check the TPM status in Windows Security.

Some updates use a boot screen rather than a Windows installer. Follow the manufacturer's instructions on that screen. The process may take several minutes.

### Step 4: Clear the TPM only if the update requires it

Some Microsoft security advisories require a TPM clear after the firmware update. Other firmware packages do not. Follow the instructions for your specific device.

If the package does not require a TPM clear, leave the TPM alone. Clearing it should not be a routine part of every firmware update.

## How to clear the TPM in Windows 11

Clearing the TPM returns it to an unowned state. Windows can initialize it again after the restart, but the process removes keys stored in the TPM. So Treat it as a destructive security operation. See the reference from Microsoft: https://support.microsoft.com/en-us/windows/security/device-security/update-your-security-processor-tpm-firmware

Before you begin, make sure that:

- You have the BitLocker recovery key.
- You have a backup of files protected by the TPM.
- You know how to reset your Windows Hello PIN.
- You own the device or have written instructions from the IT administrator.
- You do not need a virtual smart card that uses the current TPM keys.

Then clear the TPM:

1. Open **Windows Security**.
2. Select **Device security**.
3. Select **Security processor details**.
4. Select **Security processor troubleshooting**.
5. Select **Clear TPM**.
6. Read the warning.
7. Confirm the action.
8. Restart the computer.
9. Confirm the TPM clear on the firmware screen if Windows asks you to.
10. Sign in to Windows after the restart.
11. Open Windows Security and confirm that the Security processor is ready.

Do not clear the TPM directly from UEFI firmware. Use Windows Security or the supported Windows TPM management function. 

## Clear the TPM in Windows 11 with BitLocker enabled

BitLocker uses the TPM to protect the system drive. A TPM clear, BIOS update, firmware update, or change to TPM settings can trigger BitLocker recovery.

Use this sequence:

1. Open **Control Panel**.
2. Select **System and Security**.
3. Select **BitLocker Drive Encryption**.
4. Select **Back up your recovery key**.
5. Save the key somewhere secure that you can reach during startup.
6. Select **Suspend protection** if the option appears.
7. Perform the required TPM firmware update or TPM clear.
8. Restart the computer.
9. Enter the BitLocker recovery key if Windows asks for it.
10. Open **BitLocker Drive Encryption** again.
11. Select **Resume protection** after Windows starts normally.

If Windows asks for the recovery key and you cannot find it, do not clear or reformat the drive. Check your Microsoft account, organization account, printed records, USB storage, or IT management system. An organization may store recovery keys in Microsoft Entra ID or Active Directory.

Clearing the TPM also removes the Windows Hello PIN that depends on TPM-protected keys. Reset the PIN after Windows initializes the TPM again.  

## Fix Windows 11 TPM not detected errors

The message **Windows 11 TPM not detected** does not necessarily mean that the TPM is missing. It may be disabled, hidden, unsupported, or affected by a driver or firmware problem.

Check the following in order:

1. Restart the computer.
2. Open `tpm.msc` and read the status message.
3. Open Windows Security and look for the Security processor section.
4. Enter UEFI firmware through **Settings > System > Recovery > Advanced startup > Restart now**.
5. Select **Troubleshoot > Advanced options > UEFI Firmware Settings**.
6. Look for a TPM option under **Security**, **Advanced**, or **Trusted Computing**.
7. Enable the setting named **TPM**, **Security Device**, **Intel PTT**, **Intel Platform Trust Technology**, **AMD fTPM**, or **AMD PSP fTPM**.
8. Save the UEFI change and restart Windows.
9. Check the TPM specification version again.

![bitlocker drive encryption](/bitlocker-drive-encryption.png)

The option name varies by manufacturer. If you cannot identify the correct UEFI setting, contact the manufacturer.  

If Windows still cannot detect the TPM, install the latest approved UEFI and chipset updates. In Device Manager, check for a warning under **Security devices**. If Windows offers a Microsoft TPM driver, use it. A non-Microsoft TPM driver can prevent the default driver from loading and may cause BitLocker to report that no TPM exists. Learn more: https://learn.microsoft.com/en-us/windows/security/hardware-security/tpm/initialize-and-configure-ownership-of-the-tpm

## TPM security processor troubleshooting

Use **Security processor troubleshooting** when Windows reports a TPM error, firmware problem, or security processor problem.

1. Open **Windows Security**.
2. Select **Device security**.
3. Select **Security processor details**.
4. Select **Security processor troubleshooting**.
5. Read the message and error code.
6. Protect your BitLocker and TPM data before applying the recommended action.
7. Restart the computer.
8. Check the Security processor status again.

The recommended action may be to clear the TPM, install a firmware update, or restart the device. A TPM lockout message can result from repeated failed authorization attempts. Review the UEFI settings and contact the hardware manufacturer before changing lockout settings.  

If the problem began after a BIOS update, read the manufacturer's release notes. Confirm that the correct TPM mode is still enabled. Do not switch between multiple TPM devices unless the manufacturer or IT administrator gives you a recovery plan. Windows does not support switching between active TPMs as a normal operating procedure.  

## TPM initialization troubleshooting

Windows normally initializes the TPM and takes ownership of it automatically. You should not need to create a TPM owner password. If initialization does not finish, work through the following checks.

### Confirm UEFI and TPM settings

Make sure the computer uses a Trusted Computing Group-compliant UEFI and that the TPM is enabled and visible to the operating system. A TPM 2.0 device can remain undetected when UEFI hides it from Windows.  

### Remove unsupported TPM drivers

Open **Device Manager** and expand **Security devices**. If a non-Microsoft TPM driver is installed, follow the hardware vendor's instructions to remove it. Restart Windows and allow the default Microsoft TPM driver to load.

### Connect to the organization network

A work computer may need TPM recovery information from Active Directory Domain Services. If it cannot reach a domain controller, TPM initialization can fail. Connect the computer to the corporate network and try again. Contact your IT administrator if the error continues.  

### Clear and reinitialize the TPM

If the TPM remains failed or uninitialized, back up the recovery information and clear the TPM from Windows Security. Restart the computer and allow Windows to initialize the TPM. Reset Windows Hello and restore BitLocker protection after the process finishes.

### Contact the manufacturer

Contact the manufacturer if the TPM remains unavailable after approved firmware and UEFI updates. The cause may be a failed TPM, a motherboard fault, or a firmware defect. Replacing the motherboard can permanently remove keys stored in the TPM.  

## When you must not clear the TPM

Do not clear the TPM if:

- You do not have the BitLocker recovery key.
- The device belongs to an employer or school, and IT has not approved the action.
- The drive contains data protected by a TPM key and you have no other recovery method.
- You plan to use a virtual smart card that depends on the current TPM.
- The firmware installer does not request a TPM clear.
- You do not know whether BitLocker protection is active.

Protect your data and obtain the correct recovery information before using the manufacturer or Microsoft procedure for your device.

## Final checklist

After updating or clearing the TPM, confirm that:

- Windows Update shows no pending restart.
- The TPM specification version is 2.0.
- Windows Security says that the Security processor is ready.
- `tpm.msc` reports that the TPM is ready for use.
- BitLocker protection is resumed.
- The BitLocker recovery key is stored securely.
- Windows Hello PIN sign-in works, or the PIN has been reset.
- Device Manager shows no warning for the TPM device.
- The original TPM error no longer appears.

In summary

An approved TPM firmware update can resolve security warnings, compatibility problems, and detection errors in Windows 11. Install Windows updates first, then use the correct firmware from the computer or motherboard manufacturer. Protect the BitLocker recovery key before clearing the TPM, and use Windows Security for the clear operation instead of a direct UEFI command. If the TPM remains unavailable, check UEFI settings, drivers, organization network access, and hardware support.

If the device belongs to an organization, ask the IT administrator before changing the TPM. If the problem continues after approved firmware updates, contact the computer or motherboard manufacturer.


