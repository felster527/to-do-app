import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PENDING_INVITE_KEY } from '../../core/groups';

@Component({
  selector: 'app-join',
  template: '<p>Opening your invite...</p>',
})
export class Join implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token && typeof localStorage !== 'undefined') {
      localStorage.setItem(PENDING_INVITE_KEY, token);
    }
    this.router.navigateByUrl('/');
  }
}
