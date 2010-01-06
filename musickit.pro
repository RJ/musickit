# -------------------------------------------------
# Project created by QtCreator 2009-12-22T13:28:55
# -------------------------------------------------
QT += webkit phonon

TARGET = musickit
TEMPLATE = app
SOURCES += main.cpp \
    mainwindow.cpp \
    WebkitApi.cpp 
HEADERS += mainwindow.h \
    WebkitApi.h 



#QMAKE_LFLAGS += -static # to try and build everything (not just qt) statically


#CONFIG += static warn_off # for static qt

#LIBS += -lgloox

# explicitly link to winsock (not sure why this is needed)
#windows:LIBS += -lws2_32
