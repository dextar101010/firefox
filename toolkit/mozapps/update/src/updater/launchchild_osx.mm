/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et cindent: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Darin Fisher <darin@meer.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include <Cocoa/Cocoa.h>
#include <CoreServices/CoreServices.h>

#ifdef __ppc__
#include <sys/types.h>
#include <sys/sysctl.h>
#include <mach/machine.h>
#endif /* __ppc__ */

bool OnLeopard()
{
  static SInt32 gOSXMajor = 0x0;
  static SInt32 gOSXMinor = 0x0;

  OSErr err = ::Gestalt(gestaltSystemVersionMajor, &gOSXMajor);
  if (err != noErr) {
    return false;
  }

  err = ::Gestalt(gestaltSystemVersionMinor, &gOSXMinor);
  if (err != noErr) {
    return false;
  }

  return (gOSXMajor == 10 && gOSXMinor == 5);
}

void LaunchChild(int argc, char **argv)
{
#ifdef __ppc__
  // It's possible that the app is a universal binary running under Rosetta
  // translation because the user forced it to.  Relaunching via NSTask would
  // launch the app natively, which the user apparently doesn't want.
  // In that case, try to preserve translation.

  // If the sysctl doesn't exist, it's because Rosetta doesn't exist,
  // so don't try to force translation.  In case of other errors, just assume
  // that the app is native.

  int isNative = 0;
  size_t sz = sizeof(isNative);

  if (sysctlbyname("sysctl.proc_native", &isNative, &sz, NULL, 0) == 0 &&
      !isNative) {
    // Running translated on ppc.

    cpu_type_t preferredCPU = CPU_TYPE_POWERPC;
    sysctlbyname("sysctl.proc_exec_affinity", NULL, NULL,
                 &preferredCPU, sizeof(preferredCPU));

    // Nothing can be done to handle failure, relaunch anyway.
  }
#endif /* __ppc__ */

  NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];

  NSTask *child = [[[NSTask alloc] init] autorelease];

  // On Mac OS X 10.5 and later users can be updating to a binary which
  // will the OS might try to launch in x86_64 mode by default. Mozilla's
  // x86_64 binaries require Mac OS X 10.6 in order to run so make sure
  // that we don't try to launch a binary that won't run on Mac OS X 10.5.
  // Accomplish this by using the command line program "arch" because
  // "posix_spawnp" (which has a preferred arch attribute) is not available
  // on Mac OS X 10.4.
  if (OnLeopard()) {
    [child setLaunchPath:@"/usr/bin/arch"];
  }
  else {
    [child setLaunchPath:[NSString stringWithCString:argv[0]]];
  }

  // Set up arguments including the preferred arch and the actual target
  // binary on Mac OS X 10.5.
  NSMutableArray *args = [[[NSMutableArray alloc] init] autorelease];
  if (OnLeopard()) {
#ifdef __ppc__
    [args addObject:@"-ppc"];
#endif
    [args addObject:@"-i386"];
    [args addObject:[NSString stringWithCString:argv[0]]];
  }
  for (int i = 1; i < argc; ++i) {
    [args addObject:[NSString stringWithCString:argv[i]]];
  }
  [child setArguments:args];

  [child launch];
  [pool release];
}
