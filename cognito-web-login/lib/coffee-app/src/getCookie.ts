export const getCookie = (
  name: string,
  cookieString: string
): string | undefined => {
  const cookieArray = cookieString.split("; ");
  for (const item of cookieArray) {
    if (item.startsWith(`${name}=`)) {
      return item.substring(`${name}=`.length);
    }
  }
  return undefined;
};
