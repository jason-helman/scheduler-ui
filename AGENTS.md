# Scheduler UI Mandates

## Database Integrity
- **Read-Only Access:** This application is strictly a viewer for the scheduler output. It must **NEVER** perform `INSERT`, `UPDATE`, `DELETE`, or any other data-modifying operations on the database.
- **Query Validation:** All SQL queries implemented in the Vite middleware or any future backend components must be exclusively `SELECT` statements.
