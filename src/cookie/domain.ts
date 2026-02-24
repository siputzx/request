/*
 * Derived from tough-cookie — BSD-3-Clause License © Salesforce.com, Inc.
 */

const IP_REGEX = /(?:^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$)|(?:^(?:(?:[a-f\d]{1,4}:){7}(?:[a-f\d]{1,4}|:)|(?:[a-f\d]{1,4}:){6}(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|:[a-f\d]{1,4}|:)|(?:[a-f\d]{1,4}:){5}(?::(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,2}|:)|(?:[a-f\d]{1,4}:){4}(?:(?::[a-f\d]{1,4}){0,1}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,3}|:)|(?:[a-f\d]{1,4}:){3}(?:(?::[a-f\d]{1,4}){0,2}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,4}|:)|(?:[a-f\d]{1,4}:){2}(?:(?::[a-f\d]{1,4}){0,3}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,5}|:)|(?:[a-f\d]{1,4}:){1}(?:(?::[a-f\d]{1,4}){0,4}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,6}|:)|(?::(?:(?::[a-f\d]{1,4}){0,5}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,7}|:)))$)/;
const IP_V6_REGEX = /^\[?[a-f\d:]+\]?$/i;

function domainToASCII(domain: string): string {
  try {
    return new URL(`http://${domain}`).hostname;
  } catch {
    return domain.toLowerCase();
  }
}

export function canonicalDomain(domainName: string | null | undefined): string | undefined {
  if (domainName == null) return undefined;

  let str = domainName.trim().replace(/^\./, "");

  if (IP_V6_REGEX.test(str) && str.includes(":")) {
    if (!str.startsWith("[")) str = "[" + str;
    if (!str.endsWith("]")) str = str + "]";
    const result = domainToASCII(str);
    return result.slice(1, -1);
  }

  if (/[^\u0001-\u007f]/.test(str)) {
    return domainToASCII(str);
  }

  return str.toLowerCase();
}

export function domainMatch(
  domain?: string | null,
  cookieDomain?: string | null,
  canonicalize = true
): boolean | undefined {
  if (domain == null || cookieDomain == null) return undefined;

  const str = canonicalize ? canonicalDomain(domain) : domain;
  const domStr = canonicalize ? canonicalDomain(cookieDomain) : cookieDomain;

  if (str == null || domStr == null) return undefined;
  if (str === domStr) return true;

  const idx = str.lastIndexOf(domStr);
  if (idx <= 0) return false;
  if (str.length !== domStr.length + idx) return false;
  if (str.substring(idx - 1, idx) !== ".") return false;

  return !IP_REGEX.test(str);
}

export function permuteDomain(domain: string): string[] {
  const parts = domain.split(".").reverse();
  if (parts.length <= 2) return [domain];

  const permutations: string[] = [domain];
  for (let i = 1; i < parts.length - 1; i++) {
    permutations.push(parts.slice(0, i + 1).reverse().join("."));
  }

  return permutations;
}
