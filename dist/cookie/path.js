/*
 * Derived from tough-cookie — BSD-3-Clause License © Salesforce.com, Inc.
 */
export function pathMatch(reqPath, cookiePath) {
    if (cookiePath === reqPath)
        return true;
    if (reqPath.startsWith(cookiePath)) {
        if (cookiePath.endsWith("/"))
            return true;
        if (reqPath[cookiePath.length] === "/")
            return true;
    }
    return false;
}
export function defaultCookiePath(requestPath) {
    if (!requestPath || !requestPath.startsWith("/"))
        return "/";
    const lastSlash = requestPath.lastIndexOf("/");
    if (lastSlash === 0)
        return "/";
    return requestPath.slice(0, lastSlash);
}
//# sourceMappingURL=path.js.map