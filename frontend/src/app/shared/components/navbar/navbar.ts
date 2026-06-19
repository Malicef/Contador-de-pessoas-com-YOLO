import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly isMenuOpen = signal(false);

  readonly links: NavLink[] = [
    { label: 'Home', path: '/' },
    { label: 'Ao Vivo', path: '/live' },
    { label: 'Upload', path: '/upload' },
    { label: 'Dashboard', path: '/dashboard' },
  ];

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
