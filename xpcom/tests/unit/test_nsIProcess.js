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
 * The Original Code is XPCOM unit tests.
 *
 * The Initial Developer of the Original Code is
 * James Boston <mozilla@jamesboston.ca>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
// nsIProcess unit test
const TEST_ARGS = ["mozilla", "firefox", "thunderbird", "seamonkey", "foo",
                   "bar", "argument with spaces", "\"argument with quotes\""];

var isWindows = ("@mozilla.org/windows-registry-key;1" in Components.classes);

function get_test_program(prog)
{
  var progPath = do_get_cwd();
  progPath.append(prog);
  if (isWindows)
    progPath.leafName = progPath.leafName + ".exe";
  return progPath;
}

function set_environment()
{
  var envSvc = Components.classes["@mozilla.org/process/environment;1"].
    getService(Components.interfaces.nsIEnvironment);
  var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties);
  var greDir = dirSvc.get("GreD", Components.interfaces.nsIFile);

  envSvc.set("DYLD_LIBRARY_PATH", greDir.path);
  // For Linux
  envSvc.set("LD_LIBRARY_PATH", greDir.path);
  //XXX: handle windows
}


// test if a process can be started, polled for its running status
// and then killed
function test_kill()
{
  var file = get_test_program("TestBlockingProcess");
 
  var process = Components.classes["@mozilla.org/process/util;1"]
                          .createInstance(Components.interfaces.nsIProcess);
  process.init(file);

  do_check_false(process.isRunning);

  try {
    process.kill();
    do_throw("Attempting to kill a not-running process should throw");
  }
  catch (e) { }

  process.run(false, [], 0);

  do_check_true(process.isRunning);

  process.kill();

  do_check_false(process.isRunning);

  try {
    process.kill();
    do_throw("Attempting to kill a not-running process should throw");
  }
  catch (e) { }
}

// test if we can get an exit value from an application that is
// guaranteed to return an exit value of 42
function test_quick()
{
  var file = get_test_program("TestQuickReturn");
  
  var process = Components.classes["@mozilla.org/process/util;1"]
                          .createInstance(Components.interfaces.nsIProcess);
  process.init(file);
  
  // to get an exit value it must be a blocking process
  process.run(true, [], 0);

  do_check_eq(process.exitValue, 42);
}

// test if an argument can be successfully passed to an application
// that will return 0 if "mozilla" is the only argument
function test_arguments()
{
  var file = get_test_program("TestArguments");
  
  var process = Components.classes["@mozilla.org/process/util;1"]
                          .createInstance(Components.interfaces.nsIProcess);
  process.init(file);
  
  process.run(true, TEST_ARGS, TEST_ARGS.length);
  
  do_check_eq(process.exitValue, 0);
}

// test if we get notified about a blocking process
function test_notify_blocking()
{
  var file = get_test_program("TestQuickReturn");

  var process = Components.classes["@mozilla.org/process/util;1"]
                          .createInstance(Components.interfaces.nsIProcess);
  process.init(file);

  process.runAsync([], 0, {
    observe: function(subject, topic, data) {
      process = subject.QueryInterface(Components.interfaces.nsIProcess);
      do_check_eq(topic, "process-finished");
      do_check_eq(process.exitValue, 42);
      test_notify_nonblocking();
    }
  });
}

// test if we get notified about a non-blocking process
function test_notify_nonblocking()
{
  var file = get_test_program("TestArguments");

  var process = Components.classes["@mozilla.org/process/util;1"]
                          .createInstance(Components.interfaces.nsIProcess);
  process.init(file);

  process.runAsync(TEST_ARGS, TEST_ARGS.length, {
    observe: function(subject, topic, data) {
      process = subject.QueryInterface(Components.interfaces.nsIProcess);
      do_check_eq(topic, "process-finished");
      do_check_eq(process.exitValue, 0);
      test_notify_killed();
    }
  });
}

// test if we get notified about a killed process
function test_notify_killed()
{
  var file = get_test_program("TestBlockingProcess");

  var process = Components.classes["@mozilla.org/process/util;1"]
                          .createInstance(Components.interfaces.nsIProcess);
  process.init(file);

  process.runAsync([], 0, {
    observe: function(subject, topic, data) {
      process = subject.QueryInterface(Components.interfaces.nsIProcess);
      do_check_eq(topic, "process-finished");
      do_test_finished();
    }
  });

  process.kill();
}

function run_test() {
  set_environment();
  test_kill();
  test_quick();
  test_arguments();
  do_test_pending();
  test_notify_blocking();
}
