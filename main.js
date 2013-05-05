/*
 * Copyright (c) 2013 Jeffrey Fisher.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets */

define(function (require, exports, module) {
    "use strict";

    var DocumentManager     = brackets.getModule("document/DocumentManager"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Menus               = brackets.getModule("command/Menus"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        AppInit             = brackets.getModule("utils/AppInit"),
        FileViewController  = brackets.getModule("project/FileViewController");
     
    // Used to keep track of the history of cursor and edit locations
    var cursorHistory = [],
        editHistory = [],
        posInCursorHistoryArr = 0,
        posInEditHistoryArr = 0;
    
    // Used for toolbar buttons
    var $nextEditButton,
        $prevEditButton,
        colors = {normal: "#cccccc",
                  hover: "#e6861c"};
    
    /**
    * Changes the document and position of the cursor
    * @param {object} Contains the desired document and position to move the cursor to
    */
    function changeLocation(desiredLocation) {
        var desiredPostion = desiredLocation.pos;
        var desiredDocument = desiredLocation.doc;
        var currentDocument = DocumentManager.getCurrentDocument();
        
        if (currentDocument === desiredDocument) {
            // Needs to only change position of the cursor
            var currentEditor = EditorManager.getCurrentFullEditor();
            currentEditor.setCursorPos(desiredPostion);
        } else {
            // Need to make another document the current document,
            // as well as change the position of the cursor,
            // after the document is opened
            var promise = FileViewController.openAndSelectDocument(desiredDocument.file.fullPath,
                                                                   FileViewController.WORKING_SET_VIEW);
            promise.done(function () {
                var currentEditor = EditorManager.getCurrentFullEditor();
                currentEditor.setCursorPos(desiredPostion);
            });
        }
    }
    
    function handleGotoPrevEdit() {
        if (editHistory.length) {
            if (posInEditHistoryArr > 0 && posInEditHistoryArr <= editHistory.length) {
                posInEditHistoryArr--;
                changeLocation(editHistory[posInEditHistoryArr]);
            }
        }
    }
    
    function handleGotoNextEdit() {
        if (editHistory.length) {
            if (posInEditHistoryArr >= 0 && posInEditHistoryArr < editHistory.length - 1) {
                posInEditHistoryArr++;
                changeLocation(editHistory[posInEditHistoryArr]);
            }
        }
    }
    
    function handleGotoPrevCursorChange() {
        if (cursorHistory.length) {
            if (posInCursorHistoryArr > 0 && posInCursorHistoryArr <= cursorHistory.length) {
                posInCursorHistoryArr--;
                changeLocation(cursorHistory[posInCursorHistoryArr]);
            }
        }
    }
    
    function handleGotoNextCursorChange() {
        if (cursorHistory.length) {
            if (posInCursorHistoryArr >= 0 && posInCursorHistoryArr < cursorHistory.length - 1) {
                posInCursorHistoryArr++;
                changeLocation(cursorHistory[posInCursorHistoryArr]);
            }
        }
    }
    
    /**
    * Adds a button to the toolbar
    * @param {string}   The text that is displayed on the button
    * @param {string}   The title of the button
    * @param {string}   The css class to add to the button
    * @param {function} The name of the function that will handle the click event
    */
    function addToolbarButton(text, title, cssClass, handler) {
        $nextEditButton = $("<a>")
            .text(text)
            .attr("title", title)
            .addClass(cssClass)
            .click(handler)
            .css({
                "margin":       "10px",
                "display":      "inline-block",
                "font-weight":  "bold",
                "color":        colors.normal
            })
            .hover(function () {
                $(this).css({ "color": colors.hover, "text-decoration": "none" });
            }, function () {
                $(this).css({ "color": colors.normal });
            })
            .insertAfter("#main-toolbar .buttons a:last");
    }
    
    
    /**
    * Compares two location objects to see if they
    * have the same fullPath and line and ch.
    */
    function locationsEqual(loc1, loc2) {
        if (loc1.doc.file.fullPath === loc2.doc.file.fullPath &&
                loc1.pos.line === loc2.pos.line &&
                loc1.pos.ch === loc2.pos.ch) {
            return true;
        }
        return false;
    }
    
    // When the current document changes, add a ref and register
    // a "change" event handler which will fire when the user
    // modifies the document.
    $(DocumentManager).on("currentDocumentChange", function () {
        var currentDocument = DocumentManager.getCurrentDocument();
        var currentEditor = EditorManager.getCurrentFullEditor();
        
        // Listen for document editing changes and keep track of them
        $(currentDocument).on("change", function () {
            var cursor = currentEditor.getCursorPos(true);
            editHistory.push({doc: currentDocument, pos: cursor});
            posInEditHistoryArr = editHistory.length - 1;
        });
        
        // Listen for cursor position changes and  keep track of them
        $(currentEditor).on("cursorActivity", function () {
            var cursor = currentEditor.getCursorPos(true);
            var loc = ({doc: currentDocument, pos: cursor});
            var i;
            
            // Since we don't want to 'double-track' or changes to the cursor position
            // when we are going through t he cursor position history, we will ignore
            // those positions that are already in the history
            //
            // @todo: Make this search only recent history, or find a better algorithm
            //        for when to save the change in cursor location
            for (i = cursorHistory.length - 1; i >= 0; i--) {
                if (locationsEqual(cursorHistory[i], loc)) {
                    return;
                }
            }
            
            cursorHistory.push(loc);
            posInCursorHistoryArr = cursorHistory.length - 1;
        });
    });

    // Adds the buttons to the toolbar when the app is ready.
    AppInit.appReady(function () {
        addToolbarButton("<",   "Goto Previous Edit",           "gotoPrevEdit",         handleGotoPrevEdit);
        addToolbarButton(">",   "Goto Next Edit",               "gotoNextEdit",         handleGotoNextEdit);
        addToolbarButton("<<",  "Goto Previous Cursor Change",  "gotoPrevCursorChange", handleGotoPrevCursorChange);
        addToolbarButton(">>",  "Goto Next Cursor Change",      "gotoNextCursorChange", handleGotoNextCursorChange);
    });
});
