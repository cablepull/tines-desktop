# RCA 14: Networked Drive Execution Limit (Z: drive)

## The Problem
When running the built executable from a networked drive (`Z:\`), Windows 11 returned the error: "The file size exceeds the limit allowed and cannot be saved."

## Root Cause
The original "Alpha" build bundled both `x64` and `arm64` architectures into a single "portable" executable (~200MB). 

Windows 11 (and previous versions) includes a default **50 MB** file size limit for WebDAV/networked drives, controlled by the `FileSizeLimitInBytes` registry key in `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\WebClient\Parameters`. Since our 200MB binary exceeded this hard cap, the Windows WebClient service refused to "save" (cache) the file locally for execution.

## The Fix
1.  **Registry Key Update**: The user manually increased the `FileSizeLimitInBytes` on the Windows host to allow larger binaries from networked storage.
2.  **Architecture Splitting**: We updated `package.json` to generate separate binaries for `x64` and `arm64`. This reduced the individual file size to ~100MB, making it easier to handle across various networked environments.

## Lesson
Always consider the default filesystem and security caps of the target OS (especially networked/remote storage). Splitting architectures is a critical production optimization even if the user can bypass local limits via registry edits.
