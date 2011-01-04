/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * 
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * The Original Code is Komodo code.
 * 
 * The Initial Developer of the Original Code is ActiveState Software Inc.
 * Portions created by ActiveState Software Inc are Copyright (C) 2000-2007
 * ActiveState Software Inc. All Rights Reserved.
 * 
 * Contributor(s):
 *   ActiveState Software Inc
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

(function() {

    /**
     * A href|src file handler - to help in opening files. Examples:
     *    href="#main"
     *    src="foobar.css"
     *    href="script.js"
     */

    var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://komodo/locale/hyperlinks/hyperlinks.properties");

    /**
     * Jump to the given id in the supplied view.
     * 
     * @param view {Components.interfaces.koIScintillaView} - View to look in.
     * @param {string} id - The string id to locate.
     *
     * @returns {boolean} True when found, false otherwise.
     */
    function jump_to_html_id(view, id) {
        var sm = view.scimoz;
        var text = sm.text;
        var pos = text.search(new RegExp("\\sid\\s?=\\s?['\"]" + id + "['\"][\\s>]", "i"));
        if (pos >= 0) {
            var scimoz_pos = ko.stringutils.bytelength(text.substr(0, pos));
            sm.gotoPos(scimoz_pos);
            return true;
        }
        // TODO: It would really neat if we could check for the id in all of the
        //      loaded files - or a list of all known ids.
        return false;
    }

    /**
     * Open the href location.
     */
    function filename_jump_handler(filepath) {
        if (typeof(filepath) == 'undefined') {
            var match = src_href_handler.regex_match;
            filepath = match[2];
        }
        if (filepath) {
            /**
             * @type {Components.interfaces.koIScintillaView}
             */
            var view = ko.views.manager.currentView;
            if (filepath[0] == "#") {
                // It's within this document (an anchor).
                // #1 - Look for an id=""
                if (jump_to_html_id(view, filepath.substr(1))) {
                    return;
                }
                // #2 - Look for a '<a name=...'
                var pos = text.search(new RegExp("<a\\s+(.*?\\s)?name\\s?=\\s?['\"]" + filepath.substr(1) + "['\"][\\s>]", "i"));
                if (pos >= 0) {
                    var scimoz_pos = ko.stringutils.bytelength(text.substr(0, pos));
                    sm.gotoPos(scimoz_pos);
                    return;
                } else {
                    ko.statusBar.AddMessage(_bundle.formatStringFromName("noAnchorFound.message", [filepath], 1),
                                            "hyperlinks", 3000, true);
                }
            } else if (filepath[0] == "\\" || filepath[0] == "/") {
                // It's an absolute path.
                ko.open.URI(filepath);
            } else if (filepath.search(/^\w+:\/\//) == 0) {
                // It's in a URI format - leave as is.
                ko.open.URI(filepath);
            } else {
                // It's a relative path.

                // #1 - TODO: Check mapped URIs for this path.

                // #2 - TODO: check against a list of known places (images, css,
                //            etc...).

                // #3 - default to the current directory.
                var osPathSvc = Components.classes["@activestate.com/koOsPath;1"].getService(Components.interfaces.koIOsPath);
                var view_filepath = view.koDoc.file.path;
                filepath = osPathSvc.join(ko.uriparse.dirName(view_filepath), filepath);
                ko.open.URI(filepath);
            }
        }
    }
    function src_href_jump_fn() {
        var match = src_href_handler.regex_match;
        var filepath = match[2];
        filename_jump_handler(filepath);
    }
    var src_href_handler = new ko.hyperlinks.RegexHandler(
                            "Src and Href handler",
                            new RegExp("\\b(src|href)=[\\\"'](.*?)[\\\"']", "i"),
                            src_href_jump_fn,
                            null,  /* Use the found string instead of a replacement. */
                            null,  /* All language types */
                            Components.interfaces.ISciMoz.INDIC_PLAIN,
                            RGB(0x60,0x90,0xff));
    ko.hyperlinks.addHandler(src_href_handler);


    /**
     * A generic file handler - to help in opening files. Examples:
     *    file:///foo/bar.txt
     *    /foo/bar.txt
     *    C:\foo\bar.txt
     *    \\foo\bar.txt
     */
    ko.hyperlinks.addHandler(
        new ko.hyperlinks.RegexHandler(
            "File handler",
            new RegExp("(file:|[\.]{1,2}/|\\[A-Z]:\\\\|\\\\)[^'\"<>()[\\]\\s]+", "i"),
            filename_jump_handler,
            null,  /* Use the found string instead of a replacement. */
            null,  /* All language types */
            Components.interfaces.ISciMoz.INDIC_PLAIN,
            RGB(0x60,0x90,0xff))
    );


    /**
     * A JavaScript document.getElementById() helper:
     *    document.getElementById('myid')  =>  jumps to element with id 'myid'
     *    $('#foo')                        =>  jumps to element with id 'foo'
     *
     * Note: This hyperlink handler will only show when hovering over the
     *       string section of the match, i.e. over 'myid'.
     */
    function getelementbyid_jump_handler() {
        var match = javascript_getelementbyid_handler.regex_match;
        var id = match[2];
        if (id[0] == '#') {
            id = id.substr(1);
        }
        if (id) {
            jump_to_html_id(ko.views.manager.currentView, id);
        }
    }
    var javascript_getelementbyid_handler = new ko.hyperlinks.RegexHandler(
            "getElementById handler",
            new RegExp("(getElementById|\\$)\\s*\\(\\s*[\"'](.*?)[\"']", "i"),
            getelementbyid_jump_handler,
            null,  /* Use the found string instead of a replacement. */
            ["JavaScript"],  /* Just javascript. */
            Components.interfaces.ISciMoz.INDIC_PLAIN,
            RGB(0x60,0x90,0xff));
    // Limit to JavaScript string styles.
    javascript_getelementbyid_handler.limitToTheseStyles([Components.interfaces.ISciMoz.SCE_UDL_CSL_STRING]);
    ko.hyperlinks.addHandler(javascript_getelementbyid_handler);


    /**
     * A PHP include file handler - to help in opening files. Examples:
     *    include('functions/myfile.php');
     *    require_once "foo/bar/myfile.php";
     */
    function php_jump_handler() {
        var match = php_include_handler.regex_match;
        var filepath = match[3];
        filename_jump_handler(filepath);
    }
    var php_include_handler = new ko.hyperlinks.RegexHandler(
            "File handler",
            new RegExp("(include|require|include_once|require_once)\\s*(\\(\\s*)?[\"'](.*?)[\"']\\s*\\)?", "i"),
            php_jump_handler,
            null,  /* Use the found string instead of a replacement. */
            null,  /* All language types */
            Components.interfaces.ISciMoz.INDIC_PLAIN,
            RGB(0x60,0x90,0xff));
    ko.hyperlinks.addHandler(php_include_handler);

})();
