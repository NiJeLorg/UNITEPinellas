function init() {
  document.getElementById("hamburger").onclick = openCloseNav;
  document.getElementById("closebtn").onclick = openCloseNav;
}

function openCloseNav() {
    if (hasClass(document.getElementById("mySidenav"), "closed")) {
        removeClass(document.getElementById("mySidenav"), "closed");
        removeClass(document.getElementById("main"), "closed");
        addClass(document.getElementById("mySidenav"), "open");
        addClass(document.getElementById("main"), "open");
    } else {
        removeClass(document.getElementById("mySidenav"), "open");
        removeClass(document.getElementById("main"), "open");
        addClass(document.getElementById("mySidenav"), "closed");
        addClass(document.getElementById("main"), "closed");
    }
}


function hasClass(ele,cls) {
    return !!ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
}

function addClass(ele,cls) {
    if (!hasClass(ele,cls)) ele.className += " "+cls;
}

function removeClass(ele,cls) {
    if (hasClass(ele,cls)) {
        var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
        ele.className=ele.className.replace(reg,' ');
    }
}

window.onload = init;
