#include "qplaydar/result.h"

using namespace Playdar;

Result::Result(QObject *parent) :
    QObject(parent)
{
}\

QString Result::str() const { return QString("Result(%1//%2//%3//%4//%5)").arg(m_artist).arg(m_album).arg(m_track).arg(m_sid).arg(m_score); }

QString Result::sid() const { return m_sid; }
QString Result::artist() const { return m_artist; }
QString Result::album() const { return m_album; }
QString Result::track() const { return m_track; }
QString Result::mimetype() const { return m_mimetype; }
QString Result::source() const { return m_source; }
int Result::size() const { return m_size; }
int Result::bitrate() const { return m_bitrate; }
int Result::duration() const { return m_duration; }
float Result::score() const { return m_score; }

void Result::setSid(const QString& id)           { m_sid = id; }
void Result::setArtist(const QString& what)     { m_artist = what; }
void Result::setAlbum (const QString& what)     { m_album = what; }
void Result::setTrack (const QString& what)     { m_track = what; }
void Result::setMimetype(const QString& what)   { m_mimetype = what; }
void Result::setSource(const QString& what)     { m_source = what; }
void Result::setSize(int size)                  { m_size = size; }
void Result::setBitrate(int bitrate)            { m_bitrate = bitrate; }
void Result::setDuration(int duration)          { m_duration = duration; }
void Result::setScore(float score)              { m_score = score; }
