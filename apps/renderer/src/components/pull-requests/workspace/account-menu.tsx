import { Menu } from "@base-ui/react/menu";
import { CaretUpDownIcon, UserCircleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useGitHubProfile } from "../../../session/use-github-profile";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { DropdownMenu, DropdownMenuContent } from "../../ui/dropdown-menu";

export function AccountMenu() {
  const { account, profile } = useGitHubProfile();
  if (!account) return null;
  const name = profile?.name || account.login;
  const detail = profile?.email || `@${account.login}`;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();

  return (
    <DropdownMenu>
      <Menu.Trigger
        aria-label={`Account menu for ${name}`}
        className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left outline-none hover:bg-surface-hover data-popup-open:bg-surface-selected focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Avatar className="size-9">
          <AvatarImage src={account.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" title={name}>{name}</span>
          <span className="block truncate text-xs text-text-secondary" title={detail}>{detail}</span>
        </span>
        <CaretUpDownIcon aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
      </Menu.Trigger>
      <DropdownMenuContent side="top" align="start" className="w-(--anchor-width)">
        <Menu.Item
          render={<Link to="/setup" />}
          className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-highlighted:bg-surface-hover"
        >
          <UserCircleIcon aria-hidden="true" className="size-4" />
          Account
        </Menu.Item>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
