export function isNavItemActive(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/vehicles") {
    return pathname === "/vehicles" || /^\/vehicles\/(?!maintenance(?:\/|$))/.test(pathname);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavChildActive(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/reports") {
    return pathname === href;
  }

  if (href === "/drivers") {
    return pathname === "/drivers" || /^\/drivers\/(?!payroll(?:\/|$)|trip-payroll(?:\/|$))/.test(pathname);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
