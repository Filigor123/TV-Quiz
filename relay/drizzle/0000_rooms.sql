CREATE TABLE rooms (
 id TEXT PRIMARY KEY NOT NULL,
 host_token TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE players (
 id TEXT PRIMARY KEY NOT NULL,
 room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 token TEXT NOT NULL,
 joined_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX players_room ON players(room_id);
--> statement-breakpoint
CREATE TABLE messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 sender TEXT NOT NULL,
 recipient TEXT NOT NULL,
 kind TEXT NOT NULL,
 nonce TEXT NOT NULL,
 payload TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 UNIQUE(room_id, sender, nonce)
);
--> statement-breakpoint
CREATE INDEX messages_inbox ON messages(room_id, recipient, id);
