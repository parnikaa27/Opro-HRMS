-- Development only: the director is the super admin, the one person with no reporting manager.
update employee set is_super_admin = true where id = 'OPR-0001';
